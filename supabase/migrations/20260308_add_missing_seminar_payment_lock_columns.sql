begin;

alter table public.seminars
  add column if not exists payment_locked_price numeric;

alter table public.seminars
  add column if not exists payment_locked_count integer;

alter table public.seminars
  add column if not exists payment_locked_at timestamp with time zone;

commit;
