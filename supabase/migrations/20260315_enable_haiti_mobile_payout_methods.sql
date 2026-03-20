begin;

alter table public.profiles
  add column if not exists payout_mobile_wallet_full_name text null,
  add column if not exists payout_mobile_wallet_phone text null;

alter table public.profiles
  drop constraint if exists profiles_preferred_payout_method_check;

alter table public.profiles
  add constraint profiles_preferred_payout_method_check
  check (
    preferred_payout_method is null
    or preferred_payout_method = any (
      array[
        'bank_transfer'::text,
        'paypal'::text,
        'moncash'::text,
        'natcash'::text
      ]
    )
  );

create or replace function public.get_payout_minimum(
  p_method text,
  p_country_code text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text := lower(trim(coalesce(p_method, '')));
  v_country text := upper(trim(coalesce(p_country_code, '')));
begin
  if v_method = 'paypal' then
    return 25;
  end if;

  if v_method in ('moncash', 'natcash') then
    if v_country = 'HT' then
      return 10;
    end if;
    return 25;
  end if;

  if v_method = 'bank_transfer' then
    if v_country in ('DO', 'HT') then
      return 10;
    end if;
    return 50;
  end if;

  return 25;
end;
$$;

drop function if exists public.request_withdrawal(numeric, text, text);

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_method text default null,
  p_destination text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_role text := 'student';
  v_email text;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_method text;
  v_destination text;
  v_country_code text;
  v_minimum numeric;
  v_request_id uuid;
  v_tx_id uuid;
  v_full_name text;
  v_phone text;
  v_snapshot jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not allowed';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  limit 1;

  if not found then
    raise exception 'Profile not found';
  end if;

  v_email := lower(trim(coalesce(v_profile.email, '')));
  if v_email = '' then
    raise exception 'Profile email is required';
  end if;

  if v_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  v_method := lower(trim(coalesce(p_method, v_profile.preferred_payout_method, '')));
  v_country_code := upper(trim(coalesce(v_profile.country_code, '')));

  if v_method = '' then
    raise exception 'Preferred payout method is required';
  end if;

  if v_method not in ('bank_transfer', 'paypal', 'moncash', 'natcash') then
    raise exception 'Unsupported payout method';
  end if;

  if lower(coalesce(v_profile.role, '')) in ('admin', 'teacher', 'professor') then
    v_role := 'professor';
  end if;

  if v_method = 'paypal' then
    v_destination := lower(trim(coalesce(v_profile.payout_paypal_email, p_destination, '')));
    if v_destination = '' then
      raise exception 'PayPal email is required';
    end if;

    v_snapshot := jsonb_build_object(
      'method', v_method,
      'paypal_email', v_destination
    );
  elsif v_method in ('moncash', 'natcash') then
    if v_country_code <> 'HT' then
      raise exception 'This payout method is only available for Haiti';
    end if;

    v_full_name := trim(coalesce(v_profile.payout_mobile_wallet_full_name, ''));
    v_phone := trim(coalesce(v_profile.payout_mobile_wallet_phone, ''));

    if v_full_name = '' or v_phone = '' then
      raise exception 'Mobile wallet payout name and phone are required for this payout method';
    end if;

    v_destination := v_full_name || ' | ' || v_phone;
    v_snapshot := jsonb_build_object(
      'method', v_method,
      'full_name', v_full_name,
      'phone', v_phone
    );
  else
    if nullif(trim(coalesce(v_profile.payout_bank_name, '')), '') is null
       or nullif(trim(coalesce(v_profile.payout_bank_account_name, '')), '') is null
       or nullif(trim(coalesce(v_profile.payout_bank_account_number, '')), '') is null
    then
      raise exception 'Bank payout details are incomplete';
    end if;

    v_destination := trim(v_profile.payout_bank_name) || ' | '
      || trim(v_profile.payout_bank_account_name) || ' | '
      || trim(v_profile.payout_bank_account_number);

    v_snapshot := jsonb_build_object(
      'method', v_method,
      'bank_name', nullif(trim(coalesce(v_profile.payout_bank_name, '')), ''),
      'bank_account_name', nullif(trim(coalesce(v_profile.payout_bank_account_name, '')), ''),
      'bank_account_number', nullif(trim(coalesce(v_profile.payout_bank_account_number, '')), ''),
      'bank_iban', nullif(trim(coalesce(v_profile.payout_bank_iban, '')), ''),
      'bank_swift', nullif(trim(coalesce(v_profile.payout_bank_swift, '')), '')
    );
  end if;

  v_minimum := public.get_payout_minimum(v_method, v_country_code);
  if v_amount < v_minimum then
    raise exception 'Minimum withdrawal for this method is USD %', to_char(v_minimum, 'FM999999990.00');
  end if;

  perform public.ensure_wallet(v_email, v_role);

  update public.wallets
  set balance = round(coalesce(balance, 0) - v_amount, 2),
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = v_email
    and coalesce(balance, 0) >= v_amount;

  if not found then
    raise exception 'Insufficient wallet balance';
  end if;

  insert into public.wallet_transactions (
    user_id,
    user_email,
    amount,
    type,
    description,
    status,
    wallet_id,
    metadata
  ) values (
    v_user_id,
    v_email,
    v_amount,
    'withdrawal',
    'Solicitud de retiro',
    'pending',
    v_email,
    jsonb_build_object(
      'method', v_method,
      'destination', v_destination,
      'country_code', nullif(v_country_code, ''),
      'minimum', v_minimum
    )
  )
  returning id into v_tx_id;

  insert into public.withdrawal_requests (
    user_id,
    user_email,
    amount,
    status,
    method,
    destination,
    method_snapshot,
    country_code,
    wallet_transaction_id
  ) values (
    v_user_id,
    v_email,
    v_amount,
    'pending',
    v_method,
    v_destination,
    v_snapshot,
    nullif(v_country_code, ''),
    v_tx_id
  )
  returning id into v_request_id;

  perform public.recompute_wallet_pending_balance(v_email);

  return;
end;
$$;

revoke execute on function public.request_withdrawal(numeric, text, text) from public, anon;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;

commit;
