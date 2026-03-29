begin;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'seminars'
      and policyname = 'seminars_select_published_public'
  ) then
    alter policy seminars_select_published_public
      on public.seminars
      using (status in ('published', 'completed', 'interest_only'));
  else
    create policy seminars_select_published_public
      on public.seminars
      for select
      using (status in ('published', 'completed', 'interest_only'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'seminar_interest_requests_source_type_check'
      and conrelid = 'public.seminar_interest_requests'::regclass
  ) then
    alter table public.seminar_interest_requests
      drop constraint seminar_interest_requests_source_type_check;
  end if;
end
$$;

alter table public.seminar_interest_requests
  add constraint seminar_interest_requests_source_type_check
  check (source_type = any (array['completed'::text, 'full'::text, 'prelaunch'::text]));

create or replace function public.submit_seminar_interest_request(
  p_seminar_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_country_code text default null,
  p_preferred_language text default null,
  p_message text default null,
  p_source_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seminar record;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_country_code text := nullif(upper(trim(coalesce(p_country_code, ''))), '');
  v_language text := nullif(trim(coalesce(p_preferred_language, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_source_type text := lower(trim(coalesce(p_source_type, '')));
  v_enrollment_count integer := 0;
  v_request_id uuid;
begin
  if p_seminar_id is null then
    raise exception 'Seminar is required';
  end if;

  if v_full_name = '' then
    raise exception 'Full name is required';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email is required';
  end if;

  select id, status, max_students
  into v_seminar
  from public.seminars
  where id = p_seminar_id;

  if not found then
    raise exception 'Seminar not found';
  end if;

  select count(*)::integer
  into v_enrollment_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, e.payment_status, '')) <> 'cancelled';

  if lower(coalesce(v_seminar.status, '')) = 'interest_only' then
    v_source_type := 'prelaunch';
  elsif lower(coalesce(v_seminar.status, '')) = 'completed' then
    v_source_type := 'completed';
  elsif coalesce(v_seminar.max_students, 0) > 0 and v_enrollment_count >= v_seminar.max_students then
    v_source_type := 'full';
  else
    raise exception 'This seminar is not accepting interest requests';
  end if;

  insert into public.seminar_interest_requests (
    seminar_id,
    user_id,
    full_name,
    email,
    phone,
    country_code,
    preferred_language,
    message,
    source_type,
    status,
    contacted_at,
    created_at,
    updated_at
  ) values (
    p_seminar_id,
    auth.uid(),
    v_full_name,
    v_email,
    v_phone,
    v_country_code,
    v_language,
    v_message,
    v_source_type,
    'new',
    null,
    now(),
    now()
  )
  on conflict (seminar_id, email)
  do update set
    user_id = coalesce(public.seminar_interest_requests.user_id, excluded.user_id),
    full_name = excluded.full_name,
    phone = excluded.phone,
    country_code = excluded.country_code,
    preferred_language = excluded.preferred_language,
    message = excluded.message,
    source_type = excluded.source_type,
    status = case
      when public.seminar_interest_requests.status = 'converted' then 'converted'
      else 'new'
    end,
    contacted_at = case
      when public.seminar_interest_requests.status = 'converted' then public.seminar_interest_requests.contacted_at
      else null
    end,
    updated_at = now()
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.submit_seminar_interest_request(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_seminar_interest_request(uuid, text, text, text, text, text, text, text) to anon, authenticated;

commit;
