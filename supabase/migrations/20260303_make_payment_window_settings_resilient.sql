begin;

create or replace function public.get_payment_window_days()
returns table (
  payment_open_days integer,
  payment_close_days integer
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_settings jsonb;
  v_open integer := 7;
  v_close integer := 2;
begin
  select to_jsonb(ps)
  into v_settings
  from public.platform_settings ps
  limit 1;

  if v_settings is not null then
    begin
      v_open := greatest(0, round(coalesce((v_settings ->> 'payment_open_days')::numeric, 7))::integer);
    exception
      when others then
        v_open := 7;
    end;

    begin
      v_close := greatest(0, round(coalesce((v_settings ->> 'payment_close_days')::numeric, 2))::integer);
    exception
      when others then
        v_close := 2;
    end;
  end if;

  payment_open_days := greatest(v_open, v_close);
  payment_close_days := least(v_open, v_close);
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
  q record;
  v_close_days integer := 2;
  v_close_date date;
begin
  select *
  into q
  from public.quote_price(new.seminar_id)
  limit 1;

  select pwd.payment_close_days
  into v_close_days
  from public.get_payment_window_days() pwd;

  select (s.start_date::date - v_close_days)
  into v_close_date
  from public.seminars s
  where s.id = new.seminar_id
  limit 1;

  if coalesce(q.can_pay, false)
     or (v_close_date is not null and current_date > v_close_date)
  then
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
  v_active_enrollment_count int := 0;
  v_is_full boolean := false;
  v_actor_id uuid := auth.uid();
  v_close_days integer := 2;
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

  select count(*)::int
  into v_active_enrollment_count
  from public.enrollments e2
  where e2.seminar_id = e.seminar_id
    and lower(coalesce(e2.status, '')) <> 'cancelled';

  v_is_full := coalesce(s.max_students, 0) > 0
    and v_active_enrollment_count >= coalesce(s.max_students, 0);

  select *
  into q
  from public.quote_price(e.seminar_id)
  limit 1;

  if coalesce(q.can_pay, false) is not true and not v_is_full then
    raise exception 'Ventana de pago cerrada';
  end if;

  if q.estimated_price_now is null or q.estimated_price_now <= 0 then
    raise exception 'Cannot compute a valid price (target_income/price missing)';
  end if;

  price := q.estimated_price_now;
  due_date := q.payment_due_date;

  if due_date is null then
    select pwd.payment_close_days
    into v_close_days
    from public.get_payment_window_days() pwd;

    due_date := s.start_date::date - v_close_days;
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

create or replace function public.hold_or_credit_referral_bonus(
  p_seminar_id uuid,
  p_referrer_email text,
  p_amount numeric,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_referrer_email, '')));
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_user_id uuid;
  v_title text;
  v_close_date date;
  v_close_days integer := 2;
  v_paid boolean;
begin
  if v_email = '' or v_amount <= 0 then
    return;
  end if;

  select pwd.payment_close_days
  into v_close_days
  from public.get_payment_window_days() pwd;

  select s.title, (s.start_date::date - v_close_days)
  into v_title, v_close_date
  from public.seminars s
  where s.id = p_seminar_id
  limit 1;

  v_user_id := public.find_profile_id_by_email(v_email);
  v_paid := public.is_referrer_paid_for_seminar(p_seminar_id, v_email);

  if v_paid then
    perform public.add_wallet_credit(
      v_user_id,
      v_email,
      v_amount,
      'referral_bonus',
      coalesce(p_description, 'Bono por referidos'),
      'completed',
      p_seminar_id,
      'student'
    );

    perform public.notify_user_or_email(
      v_user_id,
      v_email,
      'Bono acreditado',
      coalesce(v_title, 'Seminario') || '. Monto acreditado: USD ' || to_char(v_amount, 'FM999999990.00'),
      'success',
      '/wallet'
    );
  else
    perform public.add_wallet_credit(
      v_user_id,
      v_email,
      v_amount,
      'referral_bonus',
      coalesce(p_description, 'Bono por referidos retenido hasta pagar tu inscripcion'),
      'held',
      p_seminar_id,
      'student'
    );

    perform public.notify_user_or_email(
      v_user_id,
      v_email,
      'Bono retenido',
      coalesce(v_title, 'Seminario') || '. Monto retenido: USD ' || to_char(v_amount, 'FM999999990.00')
        || '. Debes pagar tu propia inscripcion antes del '
        || coalesce(to_char(v_close_date, 'YYYY-MM-DD'), 'cierre')
        || ' para liberarlo.',
      'warning',
      '/wallet'
    );
  end if;
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

    if rec.payment_open_date = current_date then
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

    if rec.payment_close_date = current_date then
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
    and current_date > (s.start_date::date - v_close_days);

  for v_seminar_id in
    select distinct wt.seminar_id
    from public.wallet_transactions wt
    join public.seminars s on s.id = wt.seminar_id
    where wt.type = 'referral_bonus'
      and wt.status = 'held'
      and current_date > (s.start_date::date - v_close_days)
  loop
    perform public.forfeit_held_referral_bonuses_for_seminar(v_seminar_id);
  end loop;
end;
$$;

revoke execute on function public.get_payment_window_days() from public, anon, authenticated;

commit;
