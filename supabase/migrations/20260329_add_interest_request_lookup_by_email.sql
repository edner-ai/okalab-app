begin;

create or replace function public.get_seminar_interest_request_status(
  p_seminar_id uuid,
  p_email text
)
returns table (
  request_id uuid,
  status text,
  source_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_seminar_id is null then
    return;
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return;
  end if;

  return query
  select
    r.id as request_id,
    r.status,
    r.source_type
  from public.seminar_interest_requests r
  where r.seminar_id = p_seminar_id
    and lower(trim(coalesce(r.email, ''))) = v_email
  limit 1;
end;
$$;

revoke execute on function public.get_seminar_interest_request_status(uuid, text) from public;
grant execute on function public.get_seminar_interest_request_status(uuid, text) to anon, authenticated;

commit;
