begin;

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
begin
  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
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
    select (s.start_date::date - ps.payment_close_days)
    into due_date
    from public.platform_settings ps
    limit 1;
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
    'Pago de seminario (pendiente de aprobación)',
    'pending',
    e.seminar_id
  );
end;
$$;

commit;
