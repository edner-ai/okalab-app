begin;

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text null,
  type text null default 'info',
  link text null,
  read_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id)
);

create index if not exists notifications_user_idx
  on public.notifications using btree (user_id, read_at, created_at desc);

create table if not exists public.email_outbox (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  email text null,
  subject text not null,
  body text null,
  link text null,
  status text null default 'pending',
  error text null,
  created_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone null,
  constraint email_outbox_pkey primary key (id)
);

create index if not exists email_outbox_status_idx
  on public.email_outbox using btree (status, created_at);

create table if not exists public.payment_window_notification_log (
  id uuid not null default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  seminar_id uuid not null references public.seminars(id) on delete cascade,
  user_id uuid null,
  email text null,
  event_type text not null,
  scheduled_for date not null,
  created_at timestamp with time zone not null default now(),
  constraint payment_window_notification_log_pkey primary key (id),
  constraint payment_window_notification_log_event_unique unique (enrollment_id, event_type, scheduled_for)
);

create index if not exists payment_window_notification_log_lookup_idx
  on public.payment_window_notification_log using btree (scheduled_for, event_type, seminar_id);

create or replace function public.find_profile_id_by_email(p_email text)
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.profiles p
  where nullif(trim(coalesce(p_email, '')), '') is not null
    and lower(trim(coalesce(p.email, ''))) = lower(trim(coalesce(p_email, '')))
  limit 1
$$;

create or replace function public.notify_email_address(
  p_email text,
  p_subject text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' then
    return;
  end if;

  insert into public.email_outbox(user_id, email, subject, body, link)
  values (null, v_email, p_subject, p_body, p_link);
end;
$$;

create or replace function public.notify_user(
  p_user_id uuid,
  p_title text,
  p_body text default null,
  p_type text default 'info',
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications(user_id, title, body, type, link)
  values (
    p_user_id,
    p_title,
    p_body,
    coalesce(nullif(trim(coalesce(p_type, '')), ''), 'info'),
    p_link
  );
end;
$$;

create or replace function public.notify_user_or_email(
  p_user_id uuid,
  p_email text,
  p_title text,
  p_body text default null,
  p_type text default 'info',
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is not null then
    perform public.notify_user(p_user_id, p_title, p_body, p_type, p_link);
    return;
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is not null then
    perform public.notify_email_address(p_email, p_title, p_body, p_link);
  end if;
end;
$$;

create or replace function public.notify_admins(
  p_title text,
  p_body text default null,
  p_type text default 'info',
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, title, body, type, link)
  select id, p_title, p_body, p_type, p_link
  from public.profiles
  where role = 'admin';
end;
$$;

create or replace function public.queue_email_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email
  from public.profiles
  where id = new.user_id;

  if v_email is null then
    return new;
  end if;

  insert into public.email_outbox(user_id, email, subject, body, link)
  values (new.user_id, v_email, new.title, new.body, new.link);

  return new;
end;
$$;

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
  v_close_date date;
  v_paid boolean;
begin
  if v_email = '' or v_amount <= 0 then
    return;
  end if;

  select s.title, (s.start_date::date - ps.payment_close_days)
  into v_title, v_close_date
  from public.seminars s
  join public.platform_settings ps on true
  where s.id = p_seminar_id
  limit 1;

  v_user_id := public.find_profile_id_by_email(v_email);
  v_paid := public.is_referrer_paid_for_seminar(p_seminar_id, v_email);

  if v_paid then
    perform public.add_wallet_credit(
      v_user_id,
      v_email,
      v_amount,
      'referral_bonus',
      coalesce(p_description, 'Bono por referidos'),
      'completed',
      p_seminar_id,
      'student'
    );

    perform public.notify_user_or_email(
      v_user_id,
      v_email,
      'Bono acreditado',
      coalesce(v_title, 'Seminario') || '. Monto acreditado: USD ' || to_char(v_amount, 'FM999999990.00'),
      'success',
      '/wallet'
    );
  else
    perform public.add_wallet_credit(
      v_user_id,
      v_email,
      v_amount,
      'referral_bonus',
      coalesce(p_description, 'Bono por referidos retenido hasta pagar tu inscripcion'),
      'held',
      p_seminar_id,
      'student'
    );

    perform public.notify_user_or_email(
      v_user_id,
      v_email,
      'Bono retenido',
      coalesce(v_title, 'Seminario') || '. Monto retenido: USD ' || to_char(v_amount, 'FM999999990.00')
        || '. Debes pagar tu propia inscripcion antes del '
        || coalesce(to_char(v_close_date, 'YYYY-MM-DD'), 'cierre')
        || ' para liberarlo.',
      'warning',
      '/wallet'
    );
  end if;
end;
$$;

create or replace function public.release_held_referral_bonuses(
  p_seminar_id uuid,
  p_referrer_email text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_referrer_email, '')));
  v_total numeric := 0;
  v_user_id uuid;
  v_title text;
begin
  if v_email = '' or not public.is_referrer_paid_for_seminar(p_seminar_id, v_email) then
    return 0;
  end if;

  select coalesce(sum(amount), 0)
  into v_total
  from public.wallet_transactions
  where seminar_id = p_seminar_id
    and type = 'referral_bonus'
    and status = 'held'
    and lower(trim(coalesce(user_email, ''))) = v_email;

  v_total := round(coalesce(v_total, 0), 2);

  if v_total <= 0 then
    return 0;
  end if;

  perform public.ensure_wallet(v_email, 'student');

  update public.wallet_transactions
  set status = 'completed',
      description = left(coalesce(description, 'Bono por referidos') || ' | Liberado al pagar su inscripcion', 240)
  where seminar_id = p_seminar_id
    and type = 'referral_bonus'
    and status = 'held'
    and lower(trim(coalesce(user_email, ''))) = v_email;

  update public.wallets
  set balance = coalesce(balance, 0) + v_total,
      total_earned = coalesce(total_earned, 0) + v_total,
      updated_at = now()
  where lower(trim(coalesce(user_email, ''))) = v_email;

  v_user_id := public.find_profile_id_by_email(v_email);

  select title into v_title
  from public.seminars
  where id = p_seminar_id;

  perform public.notify_user_or_email(
    v_user_id,
    v_email,
    'Bono liberado',
    coalesce(v_title, 'Seminario') || '. Se liberaron USD ' || to_char(v_total, 'FM999999990.00')
      || ' porque ya pagaste tu propia inscripcion.',
    'success',
    '/wallet'
  );

  return v_total;
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

  running_alloc := 0;
  idx := 0;

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
    select lower(trim(coalesce(user_email, ''))) as ref_email,
           round(coalesce(sum(amount), 0), 2) as total_amount
    from public.wallet_transactions
    where seminar_id = p_seminar_id
      and type = 'referral_bonus'
      and status = 'held'
      and nullif(trim(coalesce(user_email, '')), '') is not null
    group by lower(trim(coalesce(user_email, '')))
  loop
    if coalesce(r.total_amount, 0) <= 0 then
      continue;
    end if;

    update public.wallet_transactions
    set status = 'cancelled',
        description = left(coalesce(description, 'Bono por referidos') || ' | Perdido por no pagar antes del cierre', 240)
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

create or replace function public.approve_enrollment_payment(
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
  admin_role text;
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
  select coalesce(p.role, '')
  into admin_role
  from public.profiles p
  where p.id = auth.uid();

  if lower(admin_role) <> 'admin' then
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

  if lower(coalesce(e.payment_status, '')) <> 'pending_payment' then
    raise exception 'Enrollment is not pending_payment';
  end if;

  if e.final_price is null or e.final_price <= 0 then
    raise exception 'Cannot approve a zero/invalid payment';
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
  where wt.seminar_id = e.seminar_id
    and wt.user_id = e.student_id
    and wt.type = 'seminar_payment'
    and wt.status = 'pending';

  perform public.ensure_wallet(s.professor_email, 'professor');
  perform public.ensure_wallet(platform_email, 'platform');
  perform public.release_held_referral_bonuses(e.seminar_id, e.student_email);

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
      description = left(coalesce(wt.description, '') || ' | ' || coalesce(p_reason, 'Rejected by admin'), 240)
  where wt.seminar_id = e_enr.seminar_id
    and wt.type = 'seminar_payment'
    and wt.status = 'pending'
    and wt.user_id = e_enr.student_id;
end;
$$;

create or replace function public.handle_enrollment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid;
  v_title text;
  v_old text;
  v_new text;
begin
  select coalesce(professor_id, instructor_id), title
  into v_prof, v_title
  from public.seminars
  where id = new.seminar_id;

  if tg_op = 'INSERT' then
    perform public.notify_user(v_prof, 'Nuevo estudiante inscrito', coalesce(new.student_email, ''), 'info', '/seminars/' || new.seminar_id);
    perform public.notify_admins('Nueva inscripcion', v_title || ' - ' || coalesce(new.student_email, ''), 'info', '/admin/enrollments');
  end if;

  if tg_op = 'UPDATE' then
    v_old := lower(coalesce(old.payment_status, ''));
    v_new := lower(coalesce(new.payment_status, ''));

    if v_old <> v_new then
      if v_new = 'pending_payment' then
        perform public.notify_user_or_email(
          new.student_id,
          new.student_email,
          'Pago pendiente',
          v_title,
          'warning',
          '/process-payment?enrollment_id=' || new.id
        );
        perform public.notify_admins('Pago pendiente', v_title || ' - ' || coalesce(new.student_email, ''), 'warning', '/admin/enrollments');
      elsif v_new = 'paid' then
        perform public.notify_user_or_email(
          new.student_id,
          new.student_email,
          'Pago aprobado',
          v_title,
          'success',
          '/seminars/' || new.seminar_id
        );
        perform public.notify_user(v_prof, 'Pago aprobado', v_title, 'success', '/admin/enrollments');
      elsif v_new = 'rejected' then
        perform public.notify_user_or_email(
          new.student_id,
          new.student_email,
          'Pago rechazado',
          v_title,
          'error',
          '/process-payment?enrollment_id=' || new.id
        );
      elsif v_new = 'expired' then
        perform public.notify_user_or_email(
          new.student_id,
          new.student_email,
          'Reserva vencida',
          v_title || '. No pagaste antes del cierre de la ventana de pago.',
          'warning',
          '/my-seminars'
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_seminar_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid;
  v_status text;
begin
  v_prof := coalesce(new.professor_id, new.instructor_id);
  v_status := lower(coalesce(new.status, ''));

  if tg_op = 'INSERT' then
    perform public.notify_user(v_prof, 'Seminario creado', new.title, 'info', '/my-seminars');
    perform public.notify_admins('Nuevo seminario creado', new.title, 'info', '/admin/seminars');
  end if;

  if tg_op = 'UPDATE' and lower(coalesce(old.status, '')) <> v_status then
    if v_status = 'published' then
      perform public.notify_user(v_prof, 'Seminario publicado', new.title, 'success', '/seminars/' || new.id);
      perform public.notify_admins('Seminario publicado', new.title, 'success', '/admin/seminars');
    end if;

    if v_status in ('cancelled', 'canceled') then
      insert into public.notifications(user_id, title, body, type, link)
      select e.student_id, 'Seminario cancelado', new.title, 'error', '/seminars/' || new.id
      from public.enrollments e
      where e.seminar_id = new.id
        and e.student_id is not null
        and lower(coalesce(e.status, '')) <> 'cancelled';

      perform public.notify_admins('Seminario cancelado', new.title, 'error', '/admin/seminars');
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.process_payment_window_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_log_id uuid;
  v_title text;
  v_body text;
  v_link text;
begin
  for rec in
    select
      e.id as enrollment_id,
      e.student_id,
      e.student_email,
      e.seminar_id,
      s.title,
      (s.start_date::date - ps.payment_open_days) as payment_open_date,
      (s.start_date::date - ps.payment_close_days) as payment_close_date
    from public.enrollments e
    join public.seminars s on s.id = e.seminar_id
    join public.platform_settings ps on true
    where s.start_date is not null
      and lower(coalesce(e.payment_status, '')) in ('unpaid', 'rejected')
  loop
    v_link := '/process-payment?enrollment_id=' || rec.enrollment_id;

    if rec.payment_open_date = current_date then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_open',
        rec.payment_open_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Pagos abiertos';
        v_body := rec.title || '. Ya puedes pagar y la ventana cierra el ' || to_char(rec.payment_close_date, 'YYYY-MM-DD') || '.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'info', v_link);
      end if;
    end if;

    if rec.payment_close_date = current_date then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_close',
        rec.payment_close_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Ultimo dia para pagar';
        v_body := rec.title || '. Hoy cierra tu ventana de pago.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'warning', v_link);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.expire_unpaid_enrollments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seminar_id uuid;
begin
  update public.enrollments e
  set payment_status = 'expired',
      status = 'cancelled'
  from public.seminars s
  join public.platform_settings ps on true
  where e.seminar_id = s.id
    and coalesce(e.payment_status, '') in ('unpaid', 'pending_payment', 'rejected', '')
    and current_date > (s.start_date::date - ps.payment_close_days);

  for v_seminar_id in
    select distinct wt.seminar_id
    from public.wallet_transactions wt
    join public.seminars s on s.id = wt.seminar_id
    join public.platform_settings ps on true
    where wt.type = 'referral_bonus'
      and wt.status = 'held'
      and current_date > (s.start_date::date - ps.payment_close_days)
  loop
    perform public.forfeit_held_referral_bonuses_for_seminar(v_seminar_id);
  end loop;
end;
$$;

drop trigger if exists trg_queue_email_on_notification on public.notifications;
create trigger trg_queue_email_on_notification
after insert on public.notifications
for each row
execute function public.queue_email_for_notification();

drop trigger if exists trg_enrollment_notifications on public.enrollments;
create trigger trg_enrollment_notifications
after insert or update of payment_status on public.enrollments
for each row
execute function public.handle_enrollment_notifications();

drop trigger if exists trg_seminar_notifications on public.seminars;
create trigger trg_seminar_notifications
after insert or update of status on public.seminars
for each row
execute function public.handle_seminar_notifications();

do $outer$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'payment_window_notifications'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'payment_window_notifications',
      '0 * * * *',
      'select public.process_payment_window_notifications();'
    );
  end if;
end;
$outer$;

commit;
