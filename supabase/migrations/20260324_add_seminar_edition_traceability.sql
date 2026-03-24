begin;

alter table public.seminars
  add column if not exists source_seminar_id uuid null references public.seminars (id) on delete set null,
  add column if not exists source_interest_request_id uuid null references public.seminar_interest_requests (id) on delete set null;

create index if not exists seminars_source_seminar_idx
  on public.seminars (source_seminar_id);

create index if not exists seminars_source_interest_request_idx
  on public.seminars (source_interest_request_id);

commit;
