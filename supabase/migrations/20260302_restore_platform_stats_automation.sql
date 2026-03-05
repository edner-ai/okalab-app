begin;

create or replace function public.handle_refresh_platform_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_platform_stats();

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_refresh_platform_stats on public.profiles;
create trigger trg_profiles_refresh_platform_stats
after insert or delete or update of role on public.profiles
for each row
execute function public.handle_refresh_platform_stats();

drop trigger if exists trg_seminars_refresh_platform_stats on public.seminars;
create trigger trg_seminars_refresh_platform_stats
after insert or delete or update of status on public.seminars
for each row
execute function public.handle_refresh_platform_stats();

drop trigger if exists trg_seminar_reviews_refresh_platform_stats on public.seminar_reviews;
create trigger trg_seminar_reviews_refresh_platform_stats
after insert or delete or update of rating on public.seminar_reviews
for each row
execute function public.handle_refresh_platform_stats();

revoke execute on function public.handle_refresh_platform_stats() from public, anon, authenticated;

select public.refresh_platform_stats();

commit;
