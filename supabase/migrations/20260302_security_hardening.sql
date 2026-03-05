begin;

alter table public.email_outbox enable row level security;
alter table public.payment_window_notification_log enable row level security;
alter table public.platform_stats enable row level security;

revoke all on table public.email_outbox from public, anon, authenticated;
revoke all on table public.payment_window_notification_log from public, anon, authenticated;
revoke all on table public.platform_stats from public, anon, authenticated;

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
    'Pago de seminario (pendiente de aprobacion)',
    'pending',
    e.seminar_id
  );
end;
$$;

revoke execute on function public.add_wallet_credit(uuid, text, numeric, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_wallet_for_profile() from public, anon, authenticated;
revoke execute on function public.ensure_wallet(text, text) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_enrollments() from public, anon, authenticated;
revoke execute on function public.forfeit_held_referral_bonuses_for_seminar(uuid) from public, anon, authenticated;
revoke execute on function public.handle_enrollment_notifications() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_seminar_notifications() from public, anon, authenticated;
revoke execute on function public.hold_or_credit_referral_bonus(uuid, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_email_address(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_user_or_email(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.process_payment_window_notifications() from public, anon, authenticated;
revoke execute on function public.queue_email_for_notification() from public, anon, authenticated;
revoke execute on function public.redistribute_forfeited_referral_pool(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.refresh_platform_stats() from public, anon, authenticated;
revoke execute on function public.release_held_referral_bonuses(uuid, text) from public, anon, authenticated;
revoke execute on function public.sync_wallet_user_type() from public, anon, authenticated;

revoke execute on function public.approve_enrollment_payment(uuid) from public, anon;
grant execute on function public.approve_enrollment_payment(uuid) to authenticated;

revoke execute on function public.approve_withdrawal(uuid) from public, anon;
grant execute on function public.approve_withdrawal(uuid) to authenticated;

revoke execute on function public.get_inviter_email(uuid, uuid) from public, anon;
grant execute on function public.get_inviter_email(uuid, uuid) to authenticated;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke execute on function public.pay_enrollment(uuid) from public, anon;
grant execute on function public.pay_enrollment(uuid) to authenticated;

revoke execute on function public.reject_enrollment_payment(uuid) from public, anon;
grant execute on function public.reject_enrollment_payment(uuid) to authenticated;

revoke execute on function public.reject_enrollment_payment(uuid, text) from public, anon;
grant execute on function public.reject_enrollment_payment(uuid, text) to authenticated;

revoke execute on function public.reject_withdrawal(uuid, text) from public, anon;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

revoke execute on function public.request_withdrawal(numeric, text, text) from public, anon;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;

commit;
