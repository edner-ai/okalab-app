begin;

create or replace function public.get_seminar_enrollment_counts()
returns table (
  seminar_id uuid,
  enrolled_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    seminar_id,
    count(*)::int as enrolled_count
  from public.enrollments
  where coalesce(payment_status, '') not in ('cancelled', 'expired')
  group by seminar_id
$$;

revoke execute on function public.get_seminar_enrollment_counts() from public;
grant execute on function public.get_seminar_enrollment_counts() to anon, authenticated;

commit;
