begin;

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

revoke execute on function public.cancel_held_referral_bonuses_for_seminar(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_held_referral_bonuses_for_completed_seminar(uuid) from public, anon, authenticated;

commit;
