begin;

drop trigger if exists enrollments_block_on_payment_window on public.enrollments;
drop function if exists public.submit_enrollment_payment(uuid, text, text);
drop function if exists public.pay_enrollment(uuid);
drop function if exists public.block_enrollment_when_payments_open();
drop function if exists public.quote_price(uuid);

create or replace function public.quote_price(
  p_seminar_id uuid
)
returns table (
  can_pay boolean,
  reason text,
  estimated_price_now numeric,
  payment_due_date date,
  enrollment_count integer,
  paid_count integer,
  pending_count integer,
  target_students integer,
  target_income numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_open_days integer := 7;
  v_close_days integer := 2;
  v_current_local_date date;
  v_active_enrollment_count integer := 0;
  v_paid_count integer := 0;
  v_pending_count integer := 0;
  v_price_now numeric;
  v_target_income numeric := 0;
  v_target_students integer := 0;
  v_payment_open_date date;
  v_payment_close_date date;
  v_is_payment_window_open boolean := false;
  v_is_payment_window_closed boolean := false;
  v_is_full boolean := false;
begin
  select *
  into s
  from public.seminars
  where id = p_seminar_id
  limit 1;

  if not found then
    raise exception 'Seminar not found';
  end if;

  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  v_payment_open_date := s.start_date::date - v_open_days;
  v_payment_close_date := s.start_date::date - v_close_days;
  payment_due_date := v_payment_close_date;
  v_current_local_date := public.get_santo_domingo_today();

  select count(*)::integer
  into v_active_enrollment_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) not in ('cancelled', 'expired');

  select count(*)::integer
  into v_paid_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) = 'paid';

  select count(*)::integer
  into v_pending_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) = 'pending_payment';

  enrollment_count := v_active_enrollment_count;
  paid_count := v_paid_count;
  pending_count := v_pending_count;

  v_target_income := coalesce(s.target_income, 0);
  v_target_students := coalesce(s.target_students, 0);
  target_income := v_target_income;
  target_students := v_target_students;

  if v_target_income > 0 and v_target_students > 0 then
    v_price_now := round(
      (v_target_income / least(v_target_students, greatest(1, v_active_enrollment_count)))::numeric,
      2
    );
  else
    v_price_now := coalesce(s.price, 0);
  end if;

  if v_payment_open_date is not null
     and v_current_local_date >= v_payment_open_date
     and s.payment_locked_at is null
  then
    update public.seminars
    set payment_locked_price = v_price_now,
        payment_locked_count = v_active_enrollment_count,
        payment_locked_at = now()
    where id = p_seminar_id;

    s.payment_locked_price := v_price_now;
  end if;

  estimated_price_now := coalesce(s.payment_locked_price, v_price_now);
  v_is_payment_window_open :=
    v_payment_open_date is not null
    and v_payment_close_date is not null
    and v_current_local_date >= v_payment_open_date
    and v_current_local_date <= v_payment_close_date;
  v_is_payment_window_closed :=
    v_payment_close_date is not null
    and v_current_local_date > v_payment_close_date;
  v_is_full := coalesce(s.max_students, 0) > 0
    and v_active_enrollment_count >= coalesce(s.max_students, 0);

  can_pay := not v_is_payment_window_closed and (v_is_full or v_is_payment_window_open);

  if can_pay then
    reason := null;
  else
    reason := 'Payment not allowed yet (target/date rule)';
  end if;

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

create trigger enrollments_block_on_payment_window
before insert on public.enrollments
for each row
execute function public.block_enrollment_when_payments_open();

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

create or replace function public.submit_enrollment_payment(
  p_enrollment_id uuid,
  p_payment_method_code text,
  p_payment_language text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_payment_method record;
  v_method_code text := lower(trim(coalesce(p_payment_method_code, '')));
  v_payment_language text := lower(trim(coalesce(p_payment_language, '')));
  v_method_title text;
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;

  if v_method_code = '' then
    raise exception 'Payment method is required';
  end if;

  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  limit 1;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  select method_row.*
  into v_payment_method
  from public.payment_methods method_row
  where method_row.code = v_method_code
    and method_row.enabled = true
  limit 1;

  if not found then
    raise exception 'Payment method not available';
  end if;

  if array_length(v_payment_method.visible_languages, 1) is not null
     and array_length(v_payment_method.visible_languages, 1) > 0
     and v_payment_language <> ''
     and not (v_payment_language = any(v_payment_method.visible_languages))
  then
    raise exception 'Payment method not available for this language';
  end if;

  if lower(coalesce(v_payment_method.provider, '')) = 'card' then
    raise exception 'Payment method not supported yet';
  end if;

  v_method_title := coalesce(
    nullif(v_payment_method.title_i18n ->> v_payment_language, ''),
    nullif(v_payment_method.title_i18n ->> 'es', ''),
    nullif(v_payment_method.title_i18n ->> 'en', ''),
    nullif(v_payment_method.title_i18n ->> 'fr', ''),
    nullif(v_payment_method.title_i18n ->> 'ht', ''),
    v_payment_method.code
  );

  select jsonb_build_object(
    'id', v_payment_method.id,
    'code', v_payment_method.code,
    'kind', v_payment_method.kind,
    'provider', v_payment_method.provider,
    'visible_languages', v_payment_method.visible_languages,
    'title_i18n', v_payment_method.title_i18n,
    'description_i18n', v_payment_method.description_i18n,
    'instructions_i18n', v_payment_method.instructions_i18n,
    'public_config', v_payment_method.public_config,
    'fields',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'field_key', pmf.field_key,
              'label_i18n', pmf.label_i18n,
              'help_text_i18n', pmf.help_text_i18n,
              'field_type', pmf.field_type,
              'field_value', pmf.field_value,
              'copyable', pmf.copyable,
              'enabled', pmf.enabled,
              'sort_order', pmf.sort_order
            )
            order by pmf.sort_order, pmf.created_at
          )
          from public.payment_method_fields pmf
          where pmf.payment_method_id = v_payment_method.id
            and pmf.enabled = true
        ),
        '[]'::jsonb
      )
  )
  into v_snapshot;

  perform public.pay_enrollment(p_enrollment_id);

  update public.enrollments
  set payment_method_code = v_payment_method.code,
      payment_method_title = v_method_title,
      payment_method_provider = v_payment_method.provider,
      payment_submitted_at = now(),
      payment_method_snapshot = v_snapshot
  where id = p_enrollment_id;

  update public.wallet_transactions wt
  set description = left(
    'Pago de seminario (pendiente de aprobacion) - ' || coalesce(v_method_title, v_payment_method.code),
    240
  )
  where wt.seminar_id = e.seminar_id
    and wt.user_id = e.student_id
    and wt.type = 'seminar_payment'
    and wt.status = 'pending';
end;
$$;

revoke execute on function public.quote_price(uuid) from public, anon;
grant execute on function public.quote_price(uuid) to authenticated;
revoke execute on function public.submit_enrollment_payment(uuid, text, text) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text) to authenticated;

commit;
