begin;

create or replace function public.is_referrer_paid_for_seminar(
  p_seminar_id uuid,
  p_email text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.seminar_id = p_seminar_id
      and lower(coalesce(e.payment_status, '')) = 'paid'
      and lower(trim(coalesce(e.student_email, ''))) = lower(trim(coalesce(p_email, '')))
  )
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
begin
  if v_email = '' or v_amount <= 0 then
    return;
  end if;

  select s.title
  into v_title
  from public.seminars s
  where s.id = p_seminar_id
  limit 1;

  v_user_id := public.find_profile_id_by_email(v_email);

  perform public.add_wallet_credit(
    v_user_id,
    v_email,
    v_amount,
    'referral_bonus',
    coalesce(p_description, 'Bono por referidos retenido hasta cumplir las condiciones de liberacion'),
    'held',
    p_seminar_id,
    'student'
  );

  perform public.notify_user_or_email(
    v_user_id,
    v_email,
    'Bono pendiente',
    coalesce(v_title, 'Seminario') || '. Monto retenido: USD ' || to_char(v_amount, 'FM999999990.00')
      || '. Se liberara solo si pagas tu propia inscripcion a tiempo y cuando el seminario finalice correctamente.',
    'info',
    '/wallet'
  );
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
declare
  s record;
  r record;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_excluded_email text := lower(trim(coalesce(p_excluded_email, '')));
  total_ref_count int := 0;
  ref_groups int := 0;
  running_alloc numeric := 0;
  share numeric := 0;
  idx int := 0;
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

  select count(*)::int
  into ref_groups
  from (
    select e.invited_by_email
    from public.enrollments e
    where e.seminar_id = p_seminar_id
      and lower(coalesce(e.payment_status, '')) = 'paid'
      and nullif(trim(coalesce(e.invited_by_email, '')), '') is not null
      and lower(trim(coalesce(e.invited_by_email, ''))) <> lower(trim(coalesce(s.professor_email, '')))
      and (v_excluded_email = '' or lower(trim(coalesce(e.invited_by_email, ''))) <> v_excluded_email)
      and public.is_referrer_paid_for_seminar(p_seminar_id, e.invited_by_email)
    group by e.invited_by_email
  ) eligible_groups;

  select coalesce(sum(cnt), 0)::int
  into total_ref_count
  from (
    select count(*)::int as cnt
    from public.enrollments e
    where e.seminar_id = p_seminar_id
      and lower(coalesce(e.payment_status, '')) = 'paid'
      and nullif(trim(coalesce(e.invited_by_email, '')), '') is not null
      and lower(trim(coalesce(e.invited_by_email, ''))) <> lower(trim(coalesce(s.professor_email, '')))
      and (v_excluded_email = '' or lower(trim(coalesce(e.invited_by_email, ''))) <> v_excluded_email)
      and public.is_referrer_paid_for_seminar(p_seminar_id, e.invited_by_email)
    group by e.invited_by_email
  ) eligible_counts;

  if ref_groups <= 0 or total_ref_count <= 0 then
    perform public.add_wallet_credit(
      s.professor_id,
      s.professor_email,
      v_amount,
      'surplus_distribution',
      'Bono perdido por referidor impago reasignado al profesor',
      'completed',
      p_seminar_id,
      'professor'
    );
    return;
  end if;

  for r in
    select e.invited_by_email as ref_email, count(*)::int as ref_count
    from public.enrollments e
    where e.seminar_id = p_seminar_id
      and lower(coalesce(e.payment_status, '')) = 'paid'
      and nullif(trim(coalesce(e.invited_by_email, '')), '') is not null
      and lower(trim(coalesce(e.invited_by_email, ''))) <> lower(trim(coalesce(s.professor_email, '')))
      and (v_excluded_email = '' or lower(trim(coalesce(e.invited_by_email, ''))) <> v_excluded_email)
      and public.is_referrer_paid_for_seminar(p_seminar_id, e.invited_by_email)
    group by e.invited_by_email
    order by e.invited_by_email
  loop
    idx := idx + 1;

    if idx = ref_groups then
      share := round(v_amount - running_alloc, 2);
    else
      share := round(v_amount * (r.ref_count::numeric / total_ref_count::numeric), 2);
      running_alloc := round(running_alloc + share, 2);
    end if;

    if share > 0 then
      perform public.hold_or_credit_referral_bonus(
        p_seminar_id,
        r.ref_email,
        share,
        'Redistribucion por bono perdido de referidor impago'
      );
    end if;
  end loop;
end;
$$;

create or replace function public.cancel_held_referral_bonuses_for_seminar(
  p_seminar_id uuid,
  p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_total numeric := 0;
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Bono cancelado porque el seminario no finalizo correctamente');
  v_user_id uuid;
begin
  for r in
    select
      lower(trim(coalesce(wt.user_email, ''))) as user_email,
      round(coalesce(sum(wt.amount), 0), 2) as total_amount
    from public.wallet_transactions wt
    where wt.seminar_id = p_seminar_id
      and wt.type = 'referral_bonus'
      and wt.status = 'held'
      and nullif(trim(coalesce(wt.user_email, '')), '') is not null
    group by lower(trim(coalesce(wt.user_email, '')))
  loop
    if coalesce(r.total_amount, 0) <= 0 then
      continue;
    end if;

    update public.wallet_transactions
    set status = 'cancelled',
        description = left(coalesce(description, 'Bono por referidos') || ' | ' || v_reason, 240)
    where seminar_id = p_seminar_id
      and type = 'referral_bonus'
      and status = 'held'
      and lower(trim(coalesce(user_email, ''))) = r.user_email;

    perform public.recompute_wallet_pending_balance(r.user_email);

    v_user_id := public.find_profile_id_by_email(r.user_email);

    perform public.notify_user_or_email(
      v_user_id,
      r.user_email,
      'Bono cancelado',
      v_reason,
      'warning',
      '/wallet'
    );

    v_total := round(v_total + r.total_amount, 2);
  end loop;

  return v_total;
end;
$$;

drop function if exists public.forfeit_held_referral_bonuses_for_seminar(uuid);

create or replace function public.forfeit_held_referral_bonuses_for_seminar(
  p_seminar_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  r record;
  v_user_id uuid;
  v_count int := 0;
begin
  select *
  into s
  from public.seminars
  where id = p_seminar_id
  for update;

  if not found then
    return 0;
  end if;

  for r in
    select lower(trim(coalesce(wt.user_email, ''))) as ref_email,
           round(coalesce(sum(wt.amount), 0), 2) as total_amount
    from public.wallet_transactions wt
    where wt.seminar_id = p_seminar_id
      and wt.type = 'referral_bonus'
      and wt.status = 'held'
      and nullif(trim(coalesce(wt.user_email, '')), '') is not null
      and not public.is_referrer_paid_for_seminar(p_seminar_id, wt.user_email)
    group by lower(trim(coalesce(wt.user_email, '')))
  loop
    if coalesce(r.total_amount, 0) <= 0 then
      continue;
    end if;

    update public.wallet_transactions
    set status = 'cancelled',
        description = left(coalesce(description, 'Bono por referidos') || ' | Perdido por no pagar tu propia inscripcion antes del cierre', 240)
    where seminar_id = p_seminar_id
      and type = 'referral_bonus'
      and status = 'held'
      and lower(trim(coalesce(user_email, ''))) = r.ref_email;

    v_user_id := public.find_profile_id_by_email(r.ref_email);

    perform public.notify_user_or_email(
      v_user_id,
      r.ref_email,
      'Bono perdido',
      coalesce(s.title, 'Seminario') || '. Perdiste USD ' || to_char(r.total_amount, 'FM999999990.00')
        || ' por no pagar tu propia inscripcion antes del cierre.',
      'warning',
      '/wallet'
    );

    perform public.redistribute_forfeited_referral_pool(p_seminar_id, r.total_amount, r.ref_email);
    v_count := v_count + 1;
  end loop;

  return v_count;
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
  r record;
  v_total numeric := 0;
  v_user_id uuid;
begin
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

create or replace function public.sync_referral_bonuses_on_seminar_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text := lower(coalesce(old.status, ''));
  v_new_status text := lower(coalesce(new.status, ''));
begin
  if tg_op <> 'UPDATE' or v_old_status = v_new_status then
    return new;
  end if;

  if v_new_status = 'completed' then
    perform public.release_held_referral_bonuses_for_completed_seminar(new.id);
  elsif v_new_status in ('cancelled', 'canceled') then
    perform public.cancel_held_referral_bonuses_for_seminar(new.id);
  end if;

  return new;
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
    select distinct wt.seminar_id
    from public.wallet_transactions wt
    join public.seminars s on s.id = wt.seminar_id
    join public.platform_settings ps on true
    where wt.type = 'referral_bonus'
      and wt.status = 'held'
      and current_date > (s.start_date::date - ps.payment_close_days)
  loop
    perform public.forfeit_held_referral_bonuses_for_seminar(rec.seminar_id);
  end loop;
end;
$$;

revoke execute on function public.is_referrer_paid_for_seminar(uuid, text) from public, anon, authenticated;
revoke execute on function public.hold_or_credit_referral_bonus(uuid, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.redistribute_forfeited_referral_pool(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.forfeit_held_referral_bonuses_for_seminar(uuid) from public, anon, authenticated;
revoke execute on function public.release_held_referral_bonuses_for_completed_seminar(uuid) from public, anon, authenticated;
revoke execute on function public.sync_referral_bonuses_on_seminar_status() from public, anon, authenticated;

commit;
