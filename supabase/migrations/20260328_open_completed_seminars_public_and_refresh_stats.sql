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
    execute $policy$
      alter policy seminars_select_published_public
      on public.seminars
      using (status in ('published', 'completed'))
    $policy$;
  else
    create policy seminars_select_published_public
      on public.seminars
      for select
      to public
      using (status in ('published', 'completed'));
  end if;
end $$;

select public.refresh_platform_stats();

commit;
