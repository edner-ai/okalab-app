begin;

create or replace function public.allocate_unassigned_referral_share(
  p_seminar_id uuid,
  p_amount numeric,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Excedente sin referido valido');
  v_platform_email text := 'platform@okalab.local';
  v_platform_weight numeric := 0;
  v_professor_weight numeric := 0;
  v_total_weight numeric := 0;
  v_platform_share numeric := 0;
  v_professor_share numeric := 0;
begin
  if v_amount <= 0 then
    return;
  end if;

  select *
  into s
  from public.seminars
  where id = p_seminar_id
  limit 1;

  if not found then
    return;
  end if;

  if coalesce(nullif(trim(coalesce(s.professor_email, '')), ''), '') = '' then
    raise exception 'Seminar has no professor_email';
  end if;

  perform public.ensure_wallet(v_platform_email, 'platform');
  perform public.ensure_wallet(s.professor_email, 'professor');

  v_platform_weight := greatest(coalesce(s.platform_fee_percent, 15), 0);
  v_professor_weight := greatest(coalesce(s.professor_bonus_percent, 30), 0);
  v_total_weight := v_platform_weight + v_professor_weight;

  if v_total_weight <= 0 then
    v_professor_share := v_amount;
  else
    v_platform_share := round(v_amount * (v_platform_weight / v_total_weight), 2);
    v_professor_share := round(v_amount - v_platform_share, 2);
  end if;

  if v_platform_share > 0 then
    perform public.add_wallet_credit(
      null,
      v_platform_email,
      v_platform_share,
      'platform_fee',
      v_reason || ' | Participacion plataforma',
      'completed',
      p_seminar_id,
      'platform'
    );
  end if;

  if v_professor_share > 0 then
    perform public.add_wallet_credit(
      s.professor_id,
      s.professor_email,
      v_professor_share,
      'surplus_distribution',
      v_reason || ' | Participacion profesor',
      'completed',
      p_seminar_id,
      'professor'
    );
  end if;
end;
$$;

create or replace function public.redistribute_forfeited_referral_pool(
  p_seminar_id uuid,
  p_amount numeric,
  p_excluded_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.allocate_unassigned_referral_share(
    p_seminar_id,
    p_amount,
    'Bono perdido por referidor impago'
  );
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
  fee_pct numeric;
  prof_bonus_pct numeric;
  fee_amount numeric;
  net_amount numeric;
  paid_count_before int;
  prof_excess numeric;
  ref_pool numeric;
  platform_email text := 'platform@okalab.local';
  marker text;
  referrer_email text := '';
  has_valid_referrer boolean := false;
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

  if s.professor_email is null or length(trim(s.professor_email)) = 0 then
    raise exception 'Seminar has no professor_email';
  end if;

  marker := 'dist:' || p_enrollment_id::text;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.seminar_id = e.seminar_id
      and wt.type = 'distribution_marker'
      and wt.description = marker
  ) then
    raise exception 'Distribution already executed for this enrollment';
  end if;

  select count(*)::int
  into paid_count_before
  from public.enrollments e2
  where e2.seminar_id = e.seminar_id
    and lower(coalesce(e2.payment_status, '')) = 'paid';

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

  perform public.ensure_wallet(s.professor_email, 'professor');
  perform public.ensure_wallet(platform_email, 'platform');

  fee_pct := coalesce(s.platform_fee_percent, 15) / 100.0;
  prof_bonus_pct := coalesce(s.professor_bonus_percent, 30) / 100.0;

  fee_amount := round(gross * fee_pct, 2);
  net_amount := round(gross - fee_amount, 2);
  referrer_email := lower(trim(coalesce(e.invited_by_email, '')));
  has_valid_referrer := referrer_email <> ''
    and referrer_email <> lower(trim(coalesce(s.professor_email, '')))
    and referrer_email <> lower(trim(coalesce(e.student_email, '')));

  if fee_amount > 0 then
    perform public.add_wallet_credit(
      null,
      platform_email,
      fee_amount,
      'platform_fee',
      'Comision plataforma',
      'completed',
      e.seminar_id,
      'platform'
    );
  end if;

  if paid_count_before < coalesce(s.target_students, 1) then
    if net_amount > 0 then
      perform public.add_wallet_credit(
        s.professor_id,
        s.professor_email,
        net_amount,
        'seminar_income',
        'Ingreso profesor (objetivo)',
        'completed',
        e.seminar_id,
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
        e.seminar_id,
        'professor'
      );
    end if;

    if ref_pool > 0 then
      if has_valid_referrer then
        perform public.hold_or_credit_referral_bonus(
          e.seminar_id,
          referrer_email,
          ref_pool,
          'Bono por estudiante referido'
        );
      else
        perform public.allocate_unassigned_referral_share(
          e.seminar_id,
          ref_pool,
          'Excedente sin referido valido'
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
    e.seminar_id,
    platform_email
  );
end;
$$;

revoke execute on function public.allocate_unassigned_referral_share(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.redistribute_forfeited_referral_pool(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.finalize_enrollment_payment_internal(uuid) from public, anon, authenticated;

commit;
