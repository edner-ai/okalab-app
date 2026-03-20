begin;

alter table public.profiles
  add column if not exists allow_admin_contact boolean not null default false,
  add column if not exists allow_student_contact boolean not null default false;

commit;
