begin;

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

revoke execute on function public.settle_seminar_economic_distribution(uuid) from public, anon, authenticated;

commit;
