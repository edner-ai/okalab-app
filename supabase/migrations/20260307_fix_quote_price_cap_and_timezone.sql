begin;

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
  v_is_full := coalesce(s.max_students, 0) > 0 and v_active_enrollment_count >= coalesce(s.max_students, 0);
  can_pay := not v_is_payment_window_closed and (v_is_full or v_is_payment_window_open);

  if can_pay then
    reason := null;
  else
    reason := 'Payment not allowed yet (target/date rule)';
  end if;

  return next;
end;
$$;

revoke execute on function public.quote_price(uuid) from public, anon;
grant execute on function public.quote_price(uuid) to authenticated;

commit;
