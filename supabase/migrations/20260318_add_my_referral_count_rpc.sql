begin;

create or replace function public.get_my_referral_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := '';
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select lower(trim(coalesce(p.email, '')))
  into v_email
  from public.profiles p
  where p.id = auth.uid();

  if v_email = '' then
    return 0;
  end if;

  select count(distinct lower(trim(coalesce(e.student_email, ''))))::int
  into v_count
  from public.enrollments e
  where lower(coalesce(e.payment_status, '')) = 'paid'
    and lower(trim(coalesce(e.invited_by_email, ''))) = v_email
    and nullif(trim(coalesce(e.student_email, '')), '') is not null
    and lower(trim(coalesce(e.student_email, ''))) <> v_email;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.get_my_referral_count() from public, anon;
grant execute on function public.get_my_referral_count() to authenticated;

commit;
