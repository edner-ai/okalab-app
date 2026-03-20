begin;

alter table public.seminars
  add column if not exists video_conference_platform_custom_name text;

commit;
