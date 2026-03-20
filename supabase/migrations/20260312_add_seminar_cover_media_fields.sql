begin;

alter table public.seminars
  add column if not exists cover_type text not null default 'image';

alter table public.seminars
  add column if not exists cover_video_url text;

alter table public.seminars
  add column if not exists cover_video_provider text;

alter table public.seminars
  add column if not exists cover_video_id text;

commit;
