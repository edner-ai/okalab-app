begin;

alter table public.profiles
  add column if not exists whatsapp_number text,
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists preferred_contact_method text,
  add column if not exists allow_teacher_contact boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferred_contact_method_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_contact_method_check
      check (
        preferred_contact_method is null
        or preferred_contact_method in ('email', 'phone', 'whatsapp')
      );
  end if;
end
$$;

create or replace function public.get_seminar_contact_directory(
  p_seminar_id uuid
)
returns table (
  enrollment_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  payment_status text,
  enrollment_status text,
  amount_due numeric,
  amount_paid numeric,
  preferred_contact_method text,
  allow_teacher_contact boolean,
  phone text,
  whatsapp_number text,
  whatsapp_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_is_owner boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
  into v_is_admin;

  select exists (
    select 1
    from public.seminars s
    where s.id = p_seminar_id
      and auth.uid() in (s.professor_id, s.instructor_id)
  )
  into v_is_owner;

  if not (v_is_admin or v_is_owner) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    e.id as enrollment_id,
    e.student_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(e.student_name), ''),
      nullif(trim(e.student_email), ''),
      e.student_id::text
    ) as student_name,
    case
      when v_is_admin or coalesce(p.allow_teacher_contact, false) then e.student_email
      else null
    end as student_email,
    coalesce(e.payment_status, '') as payment_status,
    coalesce(e.status, '') as enrollment_status,
    coalesce(e.final_price, 0) as amount_due,
    coalesce(e.amount_paid, 0) as amount_paid,
    p.preferred_contact_method,
    coalesce(p.allow_teacher_contact, false) as allow_teacher_contact,
    case
      when v_is_admin or coalesce(p.allow_teacher_contact, false) then p.phone
      else null
    end as phone,
    case
      when (v_is_admin or coalesce(p.allow_teacher_contact, false))
        and coalesce(p.whatsapp_enabled, false)
      then p.whatsapp_number
      else null
    end as whatsapp_number,
    coalesce(p.whatsapp_enabled, false) as whatsapp_enabled
  from public.enrollments e
  left join public.profiles p
    on p.id = e.student_id
  where e.seminar_id = p_seminar_id
  order by e.created_at asc;
end;
$$;

revoke execute on function public.get_seminar_contact_directory(uuid) from public, anon;
grant execute on function public.get_seminar_contact_directory(uuid) to authenticated;

commit;
