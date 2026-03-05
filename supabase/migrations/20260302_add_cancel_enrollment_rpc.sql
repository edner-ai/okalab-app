begin;

create or replace function public.cancel_enrollment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
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

  if lower(coalesce(e.payment_status, '')) = 'paid' then
    raise exception 'Already paid';
  end if;

  update public.enrollments
  set payment_status = 'cancelled',
      status = 'cancelled'
  where id = p_enrollment_id;
end;
$$;

revoke execute on function public.cancel_enrollment(uuid) from public, anon;
grant execute on function public.cancel_enrollment(uuid) to authenticated;

commit;
