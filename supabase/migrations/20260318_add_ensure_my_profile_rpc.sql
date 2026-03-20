begin;

create or replace function public.ensure_my_profile(
  p_preferred_language text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := '';
  v_role text := '';
  v_language text := lower(trim(coalesce(p_preferred_language, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    lower(trim(coalesce(u.email, ''))),
    lower(trim(coalesce(
      u.raw_user_meta_data->>'role',
      u.raw_app_meta_data->>'role',
      'student'
    )))
  into v_email, v_role
  from auth.users u
  where u.id = v_user_id
  limit 1;

  if v_email = '' then
    raise exception 'Authenticated user has no email';
  end if;

  if v_role = '' then
    v_role := 'student';
  end if;

  if v_language = '' then
    v_language := 'es';
  end if;

  insert into public.profiles (
    id,
    email,
    role,
    verification_status,
    is_verified,
    preferred_language,
    whatsapp_enabled,
    allow_teacher_contact,
    allow_admin_contact,
    allow_student_contact,
    updated_at
  ) values (
    v_user_id,
    v_email,
    v_role,
    'none',
    false,
    v_language,
    false,
    false,
    false,
    false,
    now()
  )
  on conflict (id) do update
  set email = coalesce(nullif(trim(coalesce(public.profiles.email, '')), ''), excluded.email),
      role = coalesce(nullif(trim(coalesce(public.profiles.role, '')), ''), excluded.role, 'student'),
      preferred_language = coalesce(nullif(trim(coalesce(public.profiles.preferred_language, '')), ''), excluded.preferred_language),
      updated_at = now();
end;
$$;

revoke execute on function public.ensure_my_profile(text) from public, anon;
grant execute on function public.ensure_my_profile(text) to authenticated;

commit;
