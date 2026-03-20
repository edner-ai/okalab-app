begin;

alter table public.profiles
  add column if not exists preferred_payout_method text null,
  add column if not exists payout_paypal_email text null,
  add column if not exists payout_bank_account_name text null,
  add column if not exists payout_bank_name text null,
  add column if not exists payout_bank_account_number text null,
  add column if not exists payout_bank_iban text null,
  add column if not exists payout_bank_swift text null,
  add column if not exists payout_mobile_wallet_full_name text null,
  add column if not exists payout_mobile_wallet_phone text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferred_payout_method_check'
  ) then
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
  end if;
end
$$;

alter table public.enrollments
  add column if not exists wallet_credit_applied numeric not null default 0,
  add column if not exists external_amount_due numeric not null default 0;

alter table if exists public.wallet_transactions
  add column if not exists enrollment_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.withdrawal_requests
  add column if not exists user_id uuid null,
  add column if not exists method text null,
  add column if not exists destination text null,
  add column if not exists method_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists country_code text null,
  add column if not exists processed_at timestamp with time zone null,
  add column if not exists processed_by uuid null,
  add column if not exists rejection_reason text null,
  add column if not exists wallet_transaction_id uuid null;

create index if not exists wallet_transactions_enrollment_id_idx
  on public.wallet_transactions (enrollment_id);

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

create or replace function public.recompute_wallet_pending_balance(
  p_user_email text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_user_email, '')));
  v_pending numeric := 0;
  v_user_type text := 'student';
begin
  if v_email = '' then
    return 0;
  end if;

  select coalesce(nullif(trim(user_type), ''), 'student')
  into v_user_type
  from public.wallets
  where lower(trim(coalesce(user_email, ''))) = v_email
  limit 1;

  perform public.ensure_wallet(v_email, coalesce(v_user_type, 'student'));

  select round(
    coalesce(
      sum(
        case
          when wt.status = 'held' then abs(coalesce(wt.amount, 0))
          when wt.type = 'withdrawal' and wt.status = 'pending' then abs(coalesce(wt.amount, 0))
          else 0
        end
      ),
      0
    ),
    2
  )
  into v_pending
  from public.wallet_transactions wt
  where lower(trim(coalesce(wt.user_email, ''))) = v_email;

  update public.wallets
  set pending_balance = v_pending,
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = v_email;

  return v_pending;
end;
$$;

create or replace function public.recompute_all_wallet_pending_balances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct lower(trim(coalesce(user_email, ''))) as user_email
    from public.wallet_transactions
    where nullif(trim(coalesce(user_email, '')), '') is not null
  loop
    perform public.recompute_wallet_pending_balance(r.user_email);
  end loop;
end;
$$;

create or replace function public.add_wallet_credit(
  p_user_id uuid,
  p_user_email text,
  p_amount numeric,
  p_type text,
  p_description text,
  p_status text,
  p_seminar_id uuid,
  p_role text default 'student'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_user_email, '')));
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_status text := lower(coalesce(nullif(trim(coalesce(p_status, '')), ''), 'completed'));
begin
  if v_email = '' or v_amount <= 0 then
    return;
  end if;

  perform public.ensure_wallet(v_email, coalesce(nullif(trim(coalesce(p_role, '')), ''), 'student'));

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
    p_user_id,
    v_email,
    v_amount,
    p_type,
    left(coalesce(p_description, p_type), 240),
    v_status,
    p_seminar_id,
    v_email
  );

  if v_status = 'completed' then
    update public.wallets
    set balance = coalesce(balance, 0) + v_amount,
        total_earned = coalesce(total_earned, 0) + v_amount,
        updated_at = now()
    where lower(trim(coalesce(user_email, ''))) = v_email;
  end if;

  perform public.recompute_wallet_pending_balance(v_email);
end;
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
    coalesce(p_description, 'Bono por referidos retenido hasta que finalice el seminario'),
    'held',
    p_seminar_id,
    'student'
  );

  perform public.notify_user_or_email(
    v_user_id,
    v_email,
    'Bono pendiente',
    coalesce(v_title, 'Seminario') || '. Monto retenido: USD ' || to_char(v_amount, 'FM999999990.00')
      || '. Se liberara cuando el seminario finalice correctamente.',
    'info',
    '/wallet'
  );
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

    perform public.ensure_wallet(r.user_email, 'student');

    update public.wallet_transactions
    set status = 'completed',
        description = left(coalesce(description, 'Bono por referidos') || ' | Liberado al finalizar el seminario', 240)
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
      'Tu bono por referidos ya esta disponible en tu Saldo Okalab.',
      'success',
      '/wallet'
    );

    v_total := round(v_total + r.total_amount, 2);
  end loop;

  return v_total;
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
begin
  return coalesce(
    round(
      public.cancel_held_referral_bonuses_for_seminar(
        p_seminar_id,
        'Bono cancelado porque el seminario no finalizo correctamente'
      )
    )::int,
    0
  );
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

drop trigger if exists trg_sync_referral_bonuses_on_seminar_status on public.seminars;
create trigger trg_sync_referral_bonuses_on_seminar_status
after update of status on public.seminars
for each row
execute function public.sync_referral_bonuses_on_seminar_status();

create or replace function public.reserve_wallet_credit_for_enrollment(
  p_enrollment_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_email text;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_user_type text := 'student';
begin
  if v_amount <= 0 then
    return 0;
  end if;

  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  if auth.uid() is null or e.student_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;

  v_email := lower(trim(coalesce(e.student_email, '')));
  if v_email = '' then
    raise exception 'Enrollment has no student_email';
  end if;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.enrollment_id = p_enrollment_id
      and wt.type = 'wallet_payment'
      and wt.status = 'pending'
  ) then
    raise exception 'Wallet credit already reserved for this enrollment';
  end if;

  select
    case
      when lower(coalesce(p.role, '')) in ('admin', 'teacher', 'professor') then 'professor'
      else 'student'
    end
  into v_user_type
  from public.profiles p
  where p.id = e.student_id;

  perform public.ensure_wallet(v_email, coalesce(v_user_type, 'student'));

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
    seminar_id,
    enrollment_id,
    wallet_id,
    metadata
  ) values (
    e.student_id,
    v_email,
    -v_amount,
    'wallet_payment',
    'Saldo Okalab reservado para pago de seminario',
    'pending',
    e.seminar_id,
    e.id,
    v_email,
    jsonb_build_object('source', 'wallet_balance')
  );

  return v_amount;
end;
$$;

create or replace function public.restore_wallet_credit_for_enrollment(
  p_enrollment_id uuid,
  p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_amount numeric := 0;
  v_email text;
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Reserva de Saldo Okalab restaurada');
begin
  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  limit 1;

  if not found then
    return 0;
  end if;

  v_email := lower(trim(coalesce(e.student_email, '')));
  if v_email = '' then
    return 0;
  end if;

  select round(coalesce(sum(abs(wt.amount)), 0), 2)
  into v_amount
  from public.wallet_transactions wt
  where wt.enrollment_id = p_enrollment_id
    and wt.type = 'wallet_payment'
    and wt.status = 'pending';

  if v_amount <= 0 then
    return 0;
  end if;

  update public.wallet_transactions
  set status = 'cancelled',
      description = left(coalesce(description, 'Saldo Okalab reservado para pago de seminario') || ' | ' || v_reason, 240)
  where enrollment_id = p_enrollment_id
    and type = 'wallet_payment'
    and status = 'pending';

  update public.wallets
  set balance = round(coalesce(balance, 0) + v_amount, 2),
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = v_email;

  return v_amount;
end;
$$;

create or replace function public.complete_wallet_credit_for_enrollment(
  p_enrollment_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric := 0;
begin
  select round(coalesce(sum(abs(wt.amount)), 0), 2)
  into v_amount
  from public.wallet_transactions wt
  where wt.enrollment_id = p_enrollment_id
    and wt.type = 'wallet_payment'
    and wt.status = 'pending';

  if v_amount <= 0 then
    return 0;
  end if;

  update public.wallet_transactions
  set status = 'completed',
      description = left(coalesce(description, 'Uso de Saldo Okalab') || ' | Aplicado al pago del seminario', 240)
  where enrollment_id = p_enrollment_id
    and type = 'wallet_payment'
    and status = 'pending';

  return v_amount;
end;
$$;

create or replace function public.prepare_enrollment_payment_internal(
  p_enrollment_id uuid,
  p_price numeric,
  p_due_date date,
  p_external_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_price numeric := round(coalesce(p_price, 0), 2);
  v_external_amount numeric := round(greatest(coalesce(p_external_amount, 0), 0), 2);
  v_wallet_amount numeric := round(greatest(v_price - v_external_amount, 0), 2);
begin
  if v_price <= 0 then
    raise exception 'Invalid price';
  end if;

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

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.enrollment_id = e.id
      and wt.type = 'seminar_payment'
      and wt.status = 'pending'
  ) then
    raise exception 'Pending payment already exists';
  end if;

  update public.enrollments
  set payment_status = 'pending_payment',
      payment_due_date = p_due_date,
      final_price = v_price,
      wallet_credit_applied = v_wallet_amount,
      external_amount_due = v_external_amount
  where id = p_enrollment_id;

  if v_external_amount > 0 then
    insert into public.wallet_transactions (
      user_id,
      user_email,
      amount,
      type,
      description,
      status,
      seminar_id,
      enrollment_id,
      wallet_id,
      metadata
    ) values (
      e.student_id,
      e.student_email,
      v_external_amount,
      'seminar_payment',
      'Pago de seminario (pendiente de aprobacion)',
      'pending',
      e.seminar_id,
      e.id,
      lower(trim(coalesce(e.student_email, ''))),
      jsonb_build_object('payment_source', 'external')
    );
  end if;
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
  r record;
  total_ref_count int := 0;
  running_alloc numeric := 0;
  share numeric := 0;
  idx int := 0;
  ref_groups int := 0;
  marker text;
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
      select count(*)::int
      into ref_groups
      from (
        select e2.invited_by_email
        from public.enrollments e2
        where e2.seminar_id = e.seminar_id
          and lower(coalesce(e2.payment_status, '')) = 'paid'
          and nullif(trim(coalesce(e2.invited_by_email, '')), '') is not null
          and lower(trim(coalesce(e2.invited_by_email, ''))) <> lower(trim(s.professor_email))
        group by e2.invited_by_email
      ) groups_ref;

      select coalesce(sum(cnt), 0)::int
      into total_ref_count
      from (
        select count(*)::int as cnt
        from public.enrollments e2
        where e2.seminar_id = e.seminar_id
          and lower(coalesce(e2.payment_status, '')) = 'paid'
          and nullif(trim(coalesce(e2.invited_by_email, '')), '') is not null
          and lower(trim(coalesce(e2.invited_by_email, ''))) <> lower(trim(s.professor_email))
        group by e2.invited_by_email
      ) counts_ref;

      if ref_groups <= 0 or total_ref_count <= 0 then
        perform public.add_wallet_credit(
          s.professor_id,
          s.professor_email,
          ref_pool,
          'surplus_distribution',
          'Pool referidos sin referidores',
          'completed',
          e.seminar_id,
          'professor'
        );
      else
        running_alloc := 0;
        idx := 0;

        for r in
          select e2.invited_by_email as ref_email, count(*)::int as ref_count
          from public.enrollments e2
          where e2.seminar_id = e.seminar_id
            and lower(coalesce(e2.payment_status, '')) = 'paid'
            and nullif(trim(coalesce(e2.invited_by_email, '')), '') is not null
            and lower(trim(coalesce(e2.invited_by_email, ''))) <> lower(trim(s.professor_email))
          group by e2.invited_by_email
          order by e2.invited_by_email
        loop
          idx := idx + 1;

          if idx = ref_groups then
            share := round(ref_pool - running_alloc, 2);
          else
            share := round(ref_pool * (r.ref_count::numeric / total_ref_count::numeric), 2);
            running_alloc := round(running_alloc + share, 2);
          end if;

          if share > 0 then
            perform public.hold_or_credit_referral_bonus(
              e.seminar_id,
              r.ref_email,
              share,
              'Bono referidos (proporcional)'
            );
          end if;
        end loop;
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
    raise exception 'Cannot compute a valid price';
  end if;

  price := q.estimated_price_now;
  due_date := coalesce(q.payment_due_date, v_state.payment_close_date);

  perform public.prepare_enrollment_payment_internal(
    p_enrollment_id,
    price,
    due_date,
    price
  );
end;
$$;

create or replace function public.submit_enrollment_payment(
  p_enrollment_id uuid,
  p_payment_method_code text,
  p_payment_language text default null,
  p_payment_country text default null,
  p_wallet_amount numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  q record;
  v_state record;
  v_payment_method record;
  v_method_code text := lower(trim(coalesce(p_payment_method_code, '')));
  v_payment_language text := lower(trim(coalesce(p_payment_language, '')));
  v_payment_country text := upper(trim(coalesce(p_payment_country, '')));
  v_wallet_amount numeric := round(greatest(coalesce(p_wallet_amount, 0), 0), 2);
  v_method_title text;
  v_snapshot jsonb := '{}'::jsonb;
  v_due_date date;
  v_price numeric;
  v_external_due numeric;
begin
  if auth.uid() is null then
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

  if e.student_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;

  if lower(coalesce(trim(e.payment_status), 'unpaid')) not in ('unpaid', 'rejected') then
    raise exception 'Enrollment is not payable';
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
    raise exception 'Cannot compute a valid price';
  end if;

  v_price := round(q.estimated_price_now::numeric, 2);
  v_due_date := coalesce(q.payment_due_date, v_state.payment_close_date);
  v_wallet_amount := least(v_wallet_amount, v_price);

  if v_wallet_amount > 0 and v_wallet_amount < 0.10 then
    raise exception 'Wallet amount must be at least USD 0.10';
  end if;

  v_external_due := round(greatest(v_price - v_wallet_amount, 0), 2);

  if v_external_due > 0 then
    if v_method_code = '' then
      raise exception 'Payment method is required';
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

    if array_length(v_payment_method.visible_countries, 1) is not null
       and array_length(v_payment_method.visible_countries, 1) > 0
    then
      if v_payment_country = '' then
        raise exception 'Payment country is required for this payment method';
      end if;

      if not (v_payment_country = any(v_payment_method.visible_countries)) then
        raise exception 'Payment method not available for this country';
      end if;
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
      'visible_countries', v_payment_method.visible_countries,
      'selected_language', nullif(v_payment_language, ''),
      'selected_country_code', nullif(v_payment_country, ''),
      'wallet_credit_applied', v_wallet_amount,
      'external_amount_due', v_external_due,
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
                'field_value_i18n', pmf.field_value_i18n,
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
  else
    v_method_title := 'Saldo Okalab';
    v_snapshot := jsonb_build_object(
      'code', 'okalab_balance',
      'provider', 'wallet',
      'title', 'Saldo Okalab',
      'wallet_credit_applied', v_wallet_amount,
      'external_amount_due', 0,
      'selected_country_code', nullif(v_payment_country, ''),
      'selected_language', nullif(v_payment_language, '')
    );
  end if;

  begin
    if v_wallet_amount > 0 then
      perform public.reserve_wallet_credit_for_enrollment(p_enrollment_id, v_wallet_amount);
    end if;

    if v_external_due > 0 then
      perform public.prepare_enrollment_payment_internal(
        p_enrollment_id,
        v_price,
        v_due_date,
        v_external_due
      );

      update public.enrollments
      set payment_method_code = v_payment_method.code,
          payment_method_title = v_method_title,
          payment_method_provider = v_payment_method.provider,
          payment_submitted_at = now(),
          payment_method_snapshot = v_snapshot,
          wallet_credit_applied = v_wallet_amount,
          external_amount_due = v_external_due
      where id = p_enrollment_id;

      update public.wallet_transactions wt
      set description = left(
        'Pago de seminario (pendiente de aprobacion) - '
          || coalesce(v_method_title, v_payment_method.code)
          || case
               when v_wallet_amount > 0
                 then ' | Saldo Okalab aplicado: USD ' || to_char(v_wallet_amount, 'FM999999990.00')
               else ''
             end,
        240
      )
      where wt.enrollment_id = p_enrollment_id
        and wt.type = 'seminar_payment'
        and wt.status = 'pending';
    else
      update public.enrollments
      set final_price = v_price,
          payment_due_date = v_due_date,
          wallet_credit_applied = v_wallet_amount,
          external_amount_due = 0,
          payment_method_code = 'okalab_balance',
          payment_method_title = v_method_title,
          payment_method_provider = 'wallet',
          payment_submitted_at = now(),
          payment_method_snapshot = v_snapshot
      where id = p_enrollment_id;

      perform public.finalize_enrollment_payment_internal(p_enrollment_id);
    end if;
  exception
    when others then
      raise;
  end;
end;
$$;

create or replace function public.submit_enrollment_payment(
  p_enrollment_id uuid,
  p_payment_method_code text,
  p_payment_language text default null,
  p_payment_country text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.submit_enrollment_payment(
    p_enrollment_id,
    p_payment_method_code,
    p_payment_language,
    p_payment_country,
    0
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
begin
  perform public.submit_enrollment_payment(
    p_enrollment_id,
    p_payment_method_code,
    p_payment_language,
    null,
    0
  );
end;
$$;

create or replace function public.approve_enrollment_payment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role text;
begin
  select coalesce(p.role, '')
  into admin_role
  from public.profiles p
  where p.id = auth.uid();

  if lower(admin_role) <> 'admin' then
    raise exception 'Not allowed';
  end if;

  perform public.finalize_enrollment_payment_internal(p_enrollment_id);
end;
$$;

create or replace function public.reject_enrollment_payment(
  p_enrollment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e_enr record;
  admin_role text;
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Rejected by admin');
begin
  select coalesce(p.role, '')
  into admin_role
  from public.profiles p
  where p.id = auth.uid();

  if lower(admin_role) <> 'admin' then
    raise exception 'Not allowed';
  end if;

  select *
  into e_enr
  from public.enrollments
  where id = p_enrollment_id
  limit 1;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  if coalesce(e_enr.payment_status, e_enr.status) <> 'pending_payment' then
    raise exception 'Enrollment is not pending_payment';
  end if;

  update public.enrollments
  set payment_status = 'rejected',
      status = 'rejected'
  where id = p_enrollment_id;

  update public.wallet_transactions wt
  set status = 'rejected',
      description = left(coalesce(wt.description, '') || ' | ' || v_reason, 240)
  where wt.enrollment_id = p_enrollment_id
    and wt.type = 'seminar_payment'
    and wt.status = 'pending';

  perform public.restore_wallet_credit_for_enrollment(
    p_enrollment_id,
    'Saldo Okalab restaurado tras rechazo de pago'
  );
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

create or replace function public.approve_withdrawal(
  p_withdrawal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  admin_role text;
begin
  select coalesce(p.role, '')
  into admin_role
  from public.profiles p
  where p.id = auth.uid();

  if lower(admin_role) <> 'admin' then
    raise exception 'Not allowed';
  end if;

  select *
  into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Withdrawal request not found';
  end if;

  if lower(coalesce(v_request.status, '')) <> 'pending' then
    raise exception 'Withdrawal is not pending';
  end if;

  update public.withdrawal_requests
  set status = 'approved',
      processed_at = now(),
      processed_by = auth.uid()
  where id = p_withdrawal_id;

  update public.wallet_transactions
  set status = 'completed',
      description = left(coalesce(description, 'Solicitud de retiro') || ' | Aprobado por admin', 240)
  where id = v_request.wallet_transaction_id
    and status = 'pending';

  update public.wallets
  set total_withdrawn = round(coalesce(total_withdrawn, 0) + round(coalesce(v_request.amount, 0), 2), 2),
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = lower(trim(coalesce(v_request.user_email, '')));

  perform public.recompute_wallet_pending_balance(v_request.user_email);
end;
$$;

create or replace function public.reject_withdrawal(
  p_withdrawal_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  admin_role text;
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Rejected by admin');
begin
  select coalesce(p.role, '')
  into admin_role
  from public.profiles p
  where p.id = auth.uid();

  if lower(admin_role) <> 'admin' then
    raise exception 'Not allowed';
  end if;

  select *
  into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Withdrawal request not found';
  end if;

  if lower(coalesce(v_request.status, '')) <> 'pending' then
    raise exception 'Withdrawal is not pending';
  end if;

  update public.withdrawal_requests
  set status = 'rejected',
      rejection_reason = v_reason,
      processed_at = now(),
      processed_by = auth.uid()
  where id = p_withdrawal_id;

  update public.wallet_transactions
  set status = 'rejected',
      description = left(coalesce(description, 'Solicitud de retiro') || ' | ' || v_reason, 240)
  where id = v_request.wallet_transaction_id
    and status = 'pending';

  update public.wallets
  set balance = round(coalesce(balance, 0) + round(coalesce(v_request.amount, 0), 2), 2),
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = lower(trim(coalesce(v_request.user_email, '')));

  perform public.recompute_wallet_pending_balance(v_request.user_email);
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
end;
$$;

revoke execute on function public.recompute_wallet_pending_balance(text) from public, anon, authenticated;
revoke execute on function public.recompute_all_wallet_pending_balances() from public, anon, authenticated;
revoke execute on function public.reserve_wallet_credit_for_enrollment(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.restore_wallet_credit_for_enrollment(uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_wallet_credit_for_enrollment(uuid) from public, anon, authenticated;
revoke execute on function public.prepare_enrollment_payment_internal(uuid, numeric, date, numeric) from public, anon, authenticated;
revoke execute on function public.finalize_enrollment_payment_internal(uuid) from public, anon, authenticated;
revoke execute on function public.release_held_referral_bonuses_for_completed_seminar(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_held_referral_bonuses_for_seminar(uuid, text) from public, anon, authenticated;
revoke execute on function public.sync_referral_bonuses_on_seminar_status() from public, anon, authenticated;

revoke execute on function public.submit_enrollment_payment(uuid, text, text) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text) to authenticated;
revoke execute on function public.submit_enrollment_payment(uuid, text, text, text) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text, text) to authenticated;
revoke execute on function public.submit_enrollment_payment(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text, text, numeric) to authenticated;
revoke execute on function public.request_withdrawal(numeric, text, text) from public, anon;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;
revoke execute on function public.approve_withdrawal(uuid) from public, anon;
grant execute on function public.approve_withdrawal(uuid) to authenticated;
revoke execute on function public.reject_withdrawal(uuid, text) from public, anon;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

commit;
