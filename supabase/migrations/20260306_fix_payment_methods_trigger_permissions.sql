begin;

do $$
begin
  if to_regprocedure('public.sync_legacy_platform_payment_settings()') is not null then
    execute 'alter function public.sync_legacy_platform_payment_settings() security definer';
    execute 'revoke execute on function public.sync_legacy_platform_payment_settings() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.handle_sync_legacy_platform_payment_settings()') is not null then
    execute 'alter function public.handle_sync_legacy_platform_payment_settings() security definer';
    execute 'revoke execute on function public.handle_sync_legacy_platform_payment_settings() from public, anon, authenticated';
  end if;
end $$;

commit;
