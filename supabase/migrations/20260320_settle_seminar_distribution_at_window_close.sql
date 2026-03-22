begin;

alter table public.seminars
  add column if not exists economic_distribution_settled_at timestamp with time zone null;

update public.seminars s
set economic_distribution_settled_at = coalesce((
  select max(wt.created_at)
  from public.wallet_transactions wt
  where wt.seminar_id = s.id
    and wt.type in ('platform_fee', 'seminar_income', 'surplus_distribution', 'referral_bonus', 'distribution_marker')
), now())
where s.economic_distribution_settled_at is null
  and exists (
    select 1
    from public.wallet_transactions wt
    where wt.seminar_id = s.id
      and wt.type in ('platform_fee', 'seminar_income', 'surplus_distribution', 'referral_bonus', 'distribution_marker')
  );

create or replace function public.settle_seminar_economic_distribution(
  p_seminar_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  e record;
  ps record;
  gross numeric;
  fee_pct numeric;
  prof_bonus_pct numeric;
  fee_amount numeric;
  net_amount numeric;
  prof_excess numeric;
  ref_pool numeric;
  payment_rank int := 0;
  target_students int := 1;
  platform_email text := 'platform@okalab.local';
  referrer_email text := '';
  has_valid_referrer boolean := false;
  marker text;
  has_open_enrollments boolean := false;
  window_closed boolean := false;
begin
  select *
  into s
  from public.seminars
  where id = p_seminar_id
  for update;

  if not found then
    return;
  end if;

  if s.economic_distribution_settled_at is not null then
    return;
  end if;

  if coalesce(nullif(trim(coalesce(s.professor_email, '')), ''), '') = '' then
    raise exception 'Seminar has no professor_email';
  end if;

  select *
  into ps
  from public.platform_settings
  limit 1;

  select exists (
    select 1
    from public.enrollments e_open
    where e_open.seminar_id = p_seminar_id
      and lower(coalesce(e_open.payment_status, '')) in ('unpaid', 'pending_payment', 'rejected', '')
  )
  into has_open_enrollments;

  window_closed := current_date > (s.start_date::date - coalesce(ps.payment_close_days, 2));

  if has_open_enrollments and not window_closed then
    return;
  end if;

  perform public.ensure_wallet(platform_email, 'platform');
  perform public.ensure_wallet(s.professor_email, 'professor');

  fee_pct := coalesce(s.platform_fee_percent, 15) / 100.0;
  prof_bonus_pct := coalesce(s.professor_bonus_percent, 30) / 100.0;
  target_students := greatest(coalesce(s.target_students, 1), 1);

  for e in
    select *
    from public.enrollments
    where seminar_id = p_seminar_id
      and lower(coalesce(payment_status, '')) = 'paid'
    order by
      created_at asc,
      payment_submitted_at asc,
      paid_at asc,
      id asc
  loop
    gross := round(coalesce(e.amount_paid, e.final_price, 0), 2);

    if gross <= 0 then
      continue;
    end if;

    payment_rank := payment_rank + 1;
    fee_amount := round(gross * fee_pct, 2);
    net_amount := round(gross - fee_amount, 2);
    referrer_email := lower(trim(coalesce(e.invited_by_email, '')));
    has_valid_referrer := referrer_email <> ''
      and referrer_email <> lower(trim(coalesce(s.professor_email, '')))
      and referrer_email <> lower(trim(coalesce(e.student_email, '')))
      and public.is_referrer_paid_for_seminar(p_seminar_id, referrer_email);

    marker := 'settled:' || e.id::text;

    if fee_amount > 0 then
      perform public.add_wallet_credit(
        null,
        platform_email,
        fee_amount,
        'platform_fee',
        'Comision plataforma',
        'completed',
        p_seminar_id,
        'platform'
      );
    end if;

    if payment_rank <= target_students then
      if net_amount > 0 then
        perform public.add_wallet_credit(
          s.professor_id,
          s.professor_email,
          net_amount,
          'seminar_income',
          'Ingreso profesor (objetivo)',
          'completed',
          p_seminar_id,
          'professor'
        );
      end if;
    else
      prof_excess := round(net_amount * prof_bonus_pct, 2);
      ref_pool := round(net_amount - prof_excess, 2);

      if prof_excess > 0 then
        perform public.add_wallet_credit(
          s.professor_id,
          s.professor_email,
          prof_excess,
          'surplus_distribution',
          'Bono profesor (excedente)',
          'completed',
          p_seminar_id,
          'professor'
        );
      end if;

      if ref_pool > 0 then
        if has_valid_referrer then
          perform public.hold_or_credit_referral_bonus(
            p_seminar_id,
            referrer_email,
            ref_pool,
            'Bono por estudiante referido'
          );
        else
          perform public.allocate_unassigned_referral_share(
            p_seminar_id,
            ref_pool,
            'Excedente sin referido valido o no elegible'
          );
        end if;
      end if;
    end if;

    insert into public.wallet_transactions (
      user_id,
      user_email,
      amount,
      type,
      description,
      status,
      seminar_id,
      wallet_id
    ) values (
      null,
      platform_email,
      0,
      'distribution_marker',
      marker,
      'completed',
      p_seminar_id,
      platform_email
    );
  end loop;

  update public.seminars
  set economic_distribution_settled_at = now()
  where id = p_seminar_id;
end;
$$;

create or replace function public.finalize_enrollment_payment_internal(
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
  gross numeric;
begin
  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  if lower(coalesce(e.payment_status, '')) not in ('pending_payment', 'unpaid', 'rejected') then
    raise exception 'Enrollment cannot be finalized';
  end if;

  if lower(coalesce(e.payment_status, '')) in ('unpaid', 'rejected')
     and round(coalesce(e.external_amount_due, 0), 2) > 0 then
    raise exception 'External payment must be submitted first';
  end if;

  if e.final_price is null or e.final_price <= 0 then
    raise exception 'Cannot approve a zero or invalid payment';
  end if;

  select *
  into s
  from public.seminars
  where id = e.seminar_id
  for update;

  if not found then
    raise exception 'Seminar not found';
  end if;

  if s.economic_distribution_settled_at is not null then
    raise exception 'Economic distribution already settled for this seminar';
  end if;

  gross := round(e.final_price::numeric, 2);

  update public.enrollments
  set payment_status = 'paid',
      amount_paid = gross,
      paid_at = now(),
      status = coalesce(nullif(status, ''), 'confirmed')
  where id = p_enrollment_id;

  update public.wallet_transactions wt
  set status = 'completed'
  where (
      wt.enrollment_id = p_enrollment_id
      or (
        wt.enrollment_id is null
        and wt.seminar_id = e.seminar_id
        and wt.user_id = e.student_id
      )
    )
    and wt.type = 'seminar_payment'
    and wt.status = 'pending';

  perform public.complete_wallet_credit_for_enrollment(p_enrollment_id);
end;
$$;

create or replace function public.release_held_referral_bonuses_for_completed_seminar(
  p_seminar_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  r record;
  v_total numeric := 0;
  v_user_id uuid;
begin
  select *
  into s
  from public.seminars
  where id = p_seminar_id
  for update;

  if not found then
    return 0;
  end if;

  if s.economic_distribution_settled_at is null then
    perform public.settle_seminar_economic_distribution(p_seminar_id);
  end if;

  perform public.forfeit_held_referral_bonuses_for_seminar(p_seminar_id);

  for r in
    select
      lower(trim(coalesce(wt.user_email, ''))) as user_email,
      round(coalesce(sum(wt.amount), 0), 2) as total_amount
    from public.wallet_transactions wt
    where wt.seminar_id = p_seminar_id
      and wt.type = 'referral_bonus'
      and wt.status = 'held'
      and nullif(trim(coalesce(wt.user_email, '')), '') is not null
      and public.is_referrer_paid_for_seminar(p_seminar_id, wt.user_email)
    group by lower(trim(coalesce(wt.user_email, '')))
  loop
    if coalesce(r.total_amount, 0) <= 0 then
      continue;
    end if;

    perform public.ensure_wallet(r.user_email, 'student');

    update public.wallet_transactions
    set status = 'completed',
        description = left(coalesce(description, 'Bono por referidos') || ' | Liberado al finalizar el seminario y cumplir pago propio', 240)
    where seminar_id = p_seminar_id
      and type = 'referral_bonus'
      and status = 'held'
      and lower(trim(coalesce(user_email, ''))) = r.user_email;

    update public.wallets
    set balance = coalesce(balance, 0) + r.total_amount,
        total_earned = coalesce(total_earned, 0) + r.total_amount,
        updated_at = now()
    where lower(trim(coalesce(user_email, ''))) = r.user_email;

    perform public.recompute_wallet_pending_balance(r.user_email);

    v_user_id := public.find_profile_id_by_email(r.user_email);

    perform public.notify_user_or_email(
      v_user_id,
      r.user_email,
      'Bono disponible',
      'Tu bono por referidos ya esta disponible en tu Saldo Okalab porque pagaste tu inscripcion y el seminario finalizo correctamente.',
      'success',
      '/wallet'
    );

    v_total := round(v_total + r.total_amount, 2);
  end loop;

  return v_total;
end;
$$;

create or replace function public.expire_unpaid_enrollments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select e.id
    from public.enrollments e
    join public.seminars s on s.id = e.seminar_id
    join public.platform_settings ps on true
    where coalesce(e.payment_status, '') in ('unpaid', 'pending_payment', 'rejected', '')
      and current_date > (s.start_date::date - ps.payment_close_days)
  loop
    update public.wallet_transactions
    set status = 'cancelled',
        description = left(coalesce(description, 'Pago de seminario') || ' | Ventana de pago cerrada', 240)
    where enrollment_id = rec.id
      and type = 'seminar_payment'
      and status = 'pending';

    perform public.restore_wallet_credit_for_enrollment(
      rec.id,
      'Saldo Okalab restaurado por cierre de ventana de pago'
    );
  end loop;

  update public.enrollments e
  set payment_status = 'expired',
      status = 'cancelled'
  from public.seminars s
  join public.platform_settings ps on true
  where e.seminar_id = s.id
    and coalesce(e.payment_status, '') in ('unpaid', 'pending_payment', 'rejected', '')
    and current_date > (s.start_date::date - ps.payment_close_days);

  for rec in
    select distinct s.id as seminar_id
    from public.seminars s
    join public.platform_settings ps on true
    where current_date > (s.start_date::date - ps.payment_close_days)
      and s.economic_distribution_settled_at is null
  loop
    perform public.settle_seminar_economic_distribution(rec.seminar_id);

    if exists (
      select 1
      from public.seminars s_done
      where s_done.id = rec.seminar_id
        and lower(coalesce(s_done.status, '')) = 'completed'
        and s_done.economic_distribution_settled_at is not null
    ) then
      perform public.release_held_referral_bonuses_for_completed_seminar(rec.seminar_id);
    end if;
  end loop;
end;
$$;

revoke execute on function public.settle_seminar_economic_distribution(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_enrollment_payment_internal(uuid) from public, anon, authenticated;
revoke execute on function public.release_held_referral_bonuses_for_completed_seminar(uuid) from public, anon, authenticated;

commit;
