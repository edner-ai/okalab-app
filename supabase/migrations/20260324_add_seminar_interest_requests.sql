begin;

create table if not exists public.seminar_interest_requests (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text null,
  country_code text null,
  preferred_language text null,
  message text null,
  source_type text not null default 'completed',
  status text not null default 'new',
  contacted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint seminar_interest_requests_source_type_check check (
    source_type = any (array['completed'::text, 'full'::text])
  ),
  constraint seminar_interest_requests_status_check check (
    status = any (array['new'::text, 'contacted'::text, 'closed'::text, 'converted'::text])
  )
);

create unique index if not exists seminar_interest_requests_seminar_email_uidx
  on public.seminar_interest_requests (seminar_id, email);

create index if not exists seminar_interest_requests_seminar_idx
  on public.seminar_interest_requests (seminar_id, created_at desc);

create index if not exists seminar_interest_requests_status_idx
  on public.seminar_interest_requests (status, created_at desc);

alter table public.seminar_interest_requests enable row level security;

drop policy if exists seminar_interest_requests_select_admin on public.seminar_interest_requests;
create policy seminar_interest_requests_select_admin
on public.seminar_interest_requests
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists seminar_interest_requests_select_professor on public.seminar_interest_requests;
create policy seminar_interest_requests_select_professor
on public.seminar_interest_requests
for select
using (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
);

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

  if lower(coalesce(v_seminar.status, '')) = 'completed' then
    v_source_type := 'completed';
  elsif coalesce(v_seminar.max_students, 0) > 0 and v_enrollment_count >= v_seminar.max_students then
    v_source_type := 'full';
  else
    raise exception 'This seminar is not accepting reopening requests';
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

create or replace function public.update_seminar_interest_request_status(
  p_request_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_can_manage boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_status not in ('new', 'contacted', 'closed', 'converted') then
    raise exception 'Invalid status';
  end if;

  select exists (
    select 1
    from public.seminar_interest_requests r
    join public.seminars s on s.id = r.seminar_id
    where r.id = p_request_id
      and (
        s.professor_id = auth.uid()
        or s.instructor_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and lower(coalesce(p.role, '')) = 'admin'
        )
      )
  )
  into v_can_manage;

  if not v_can_manage then
    raise exception 'Not allowed';
  end if;

  update public.seminar_interest_requests
  set status = v_status,
      contacted_at = case
        when v_status = 'contacted' then coalesce(contacted_at, now())
        else contacted_at
      end,
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on public.seminar_interest_requests from anon, authenticated;
grant select on public.seminar_interest_requests to authenticated;
revoke execute on function public.submit_seminar_interest_request(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_seminar_interest_request(uuid, text, text, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.update_seminar_interest_request_status(uuid, text) from public;
grant execute on function public.update_seminar_interest_request_status(uuid, text) to authenticated;

commit;
