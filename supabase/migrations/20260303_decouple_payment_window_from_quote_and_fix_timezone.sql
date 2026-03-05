begin;

create or replace function public.get_santo_domingo_today()
returns date
language sql
stable
set search_path = public
as $$
  select timezone('America/Santo_Domingo', now())::date;
$$;

create or replace function public.get_payment_window_state(
  p_seminar_id uuid
)
returns table (
  payment_open_date date,
  payment_close_date date,
  current_local_date date,
  active_enrollment_count integer,
  max_students integer,
  is_full boolean,
  is_payment_window_open boolean,
  is_payment_window_closed boolean,
  can_pay boolean,
  is_enrollment_closed boolean
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_start_date date;
  v_open_days integer := 7;
  v_close_days integer := 2;
begin
  select s.start_date::date, coalesce(s.max_students, 0)::integer
  into v_start_date, max_students
  from public.seminars s
  where s.id = p_seminar_id
  limit 1;

  if not found then
    return;
  end if;

  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  payment_open_date := v_start_date - v_open_days;
  payment_close_date := v_start_date - v_close_days;
  current_local_date := public.get_santo_domingo_today();

  select count(*)::integer
  into active_enrollment_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) <> 'cancelled';

  is_full := max_students > 0 and active_enrollment_count >= max_students;
  is_payment_window_open :=
    payment_open_date is not null
    and payment_close_date is not null
    and current_local_date >= payment_open_date
    and current_local_date <= payment_close_date;
  is_payment_window_closed :=
    payment_close_date is not null
    and current_local_date > payment_close_date;
  can_pay := not is_payment_window_closed and (is_full or is_payment_window_open);
  is_enrollment_closed := is_full or is_payment_window_open or is_payment_window_closed;

  return next;
end;
$$;

create or replace function public.block_enrollment_when_payments_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state record;
begin
  select *
  into v_state
  from public.get_payment_window_state(new.seminar_id)
  limit 1;

  if coalesce(v_state.is_enrollment_closed, false) then
    raise exception 'Inscripciones cerradas: ventana de pagos abierta o cerrada';
  end if;

  return new;
end;
$$;

create or replace function public.pay_enrollment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  s record;
  q record;
  due_date date;
  price numeric;
  v_actor_id uuid := auth.uid();
  v_state record;
begin
  if v_actor_id is null then
    raise exception 'Not allowed';
  end if;

  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  if e.student_id is distinct from v_actor_id then
    raise exception 'Not allowed';
  end if;

  if lower(coalesce(trim(e.payment_status), 'unpaid')) not in ('unpaid', 'rejected') then
    raise exception 'Enrollment is not payable';
  end if;

  select *
  into s
  from public.seminars
  where id = e.seminar_id
  limit 1;

  if not found then
    raise exception 'Seminar not found';
  end if;

  select *
  into v_state
  from public.get_payment_window_state(e.seminar_id)
  limit 1;

  if coalesce(v_state.can_pay, false) is not true then
    raise exception 'Ventana de pago cerrada';
  end if;

  select *
  into q
  from public.quote_price(e.seminar_id)
  limit 1;

  if q.estimated_price_now is null or q.estimated_price_now <= 0 then
    raise exception 'Cannot compute a valid price (target_income/price missing)';
  end if;

  price := q.estimated_price_now;
  due_date := q.payment_due_date;

  if due_date is null then
    due_date := v_state.payment_close_date;
  end if;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.seminar_id = e.seminar_id
      and wt.user_id = e.student_id
      and wt.type = 'seminar_payment'
      and wt.status = 'pending'
  ) then
    raise exception 'Pending payment already exists';
  end if;

  update public.enrollments
  set payment_status = 'pending_payment',
      payment_due_date = due_date,
      final_price = price
  where id = p_enrollment_id;

  insert into public.wallet_transactions (
    user_id,
    user_email,
    amount,
    type,
    description,
    status,
    seminar_id
  ) values (
    e.student_id,
    e.student_email,
    price,
    'seminar_payment',
    'Pago de seminario (pendiente de aprobacion)',
    'pending',
    e.seminar_id
  );
end;
$$;

create or replace function public.process_payment_window_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_log_id uuid;
  v_title text;
  v_body text;
  v_link text;
  v_open_days integer := 7;
  v_close_days integer := 2;
  v_today date := public.get_santo_domingo_today();
begin
  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  for rec in
    select
      e.id as enrollment_id,
      e.student_id,
      e.student_email,
      e.seminar_id,
      s.title,
      (s.start_date::date - v_open_days) as payment_open_date,
      (s.start_date::date - v_close_days) as payment_close_date
    from public.enrollments e
    join public.seminars s on s.id = e.seminar_id
    where s.start_date is not null
      and lower(coalesce(e.payment_status, '')) in ('unpaid', 'rejected')
  loop
    v_link := '/process-payment?enrollment_id=' || rec.enrollment_id;

    if rec.payment_open_date = v_today then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_open',
        rec.payment_open_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Pagos abiertos';
        v_body := rec.title || '. Ya puedes pagar y la ventana cierra el ' || to_char(rec.payment_close_date, 'YYYY-MM-DD') || '.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'info', v_link);
      end if;
    end if;

    if rec.payment_close_date = v_today then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_close',
        rec.payment_close_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Ultimo dia para pagar';
        v_body := rec.title || '. Hoy cierra tu ventana de pago.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'warning', v_link);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.expire_unpaid_enrollments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seminar_id uuid;
  v_close_days integer := 2;
  v_today date := public.get_santo_domingo_today();
begin
  select pwd.payment_close_days
  into v_close_days
  from public.get_payment_window_days() pwd;

  update public.enrollments e
  set payment_status = 'expired',
      status = 'cancelled'
  from public.seminars s
  where e.seminar_id = s.id
    and coalesce(e.payment_status, '') in ('unpaid', 'pending_payment', 'rejected', '')
    and v_today > (s.start_date::date - v_close_days);

  for v_seminar_id in
    select distinct wt.seminar_id
    from public.wallet_transactions wt
    join public.seminars s on s.id = wt.seminar_id
    where wt.type = 'referral_bonus'
      and wt.status = 'held'
      and v_today > (s.start_date::date - v_close_days)
  loop
    perform public.forfeit_held_referral_bonuses_for_seminar(v_seminar_id);
  end loop;
end;
$$;

revoke execute on function public.get_santo_domingo_today() from public, anon, authenticated;
revoke execute on function public.get_payment_window_state(uuid) from public, anon, authenticated;

commit;
