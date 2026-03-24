begin;

alter table public.seminars
  add column if not exists materials_access_mode text not null default 'start_date';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seminars_materials_access_mode_check'
  ) then
    alter table public.seminars
      add constraint seminars_materials_access_mode_check
      check (materials_access_mode in ('after_payment', 'start_date'));
  end if;
end $$;

create table if not exists public.seminar_materials (
  id uuid primary key default gen_random_uuid(),
  seminar_id uuid not null references public.seminars(id) on delete cascade,
  title text not null,
  description text null,
  material_type text not null,
  is_preview_public boolean not null default false,
  external_url text null,
  youtube_video_id text null,
  mime_type text null,
  bucket text null,
  storage_path text null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint seminar_materials_type_check
    check (material_type in ('file', 'youtube', 'link'))
);

alter table public.seminar_materials
  add column if not exists is_preview_public boolean not null default false;

create index if not exists seminar_materials_seminar_id_idx
  on public.seminar_materials(seminar_id, sort_order);

drop policy if exists seminar_materials_object_select on storage.objects;
create policy seminar_materials_object_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'seminar-materials'
  and exists (
    select 1
    from public.seminar_materials sm
    join public.seminars s on s.id = sm.seminar_id
    where coalesce(sm.bucket, 'seminar-materials') = 'seminar-materials'
      and sm.storage_path = storage.objects.name
      and (
        sm.is_preview_public
        or (
          auth.uid() is not null
          and (
            s.professor_id = auth.uid()
            or s.instructor_id = auth.uid()
            or exists (
              select 1
              from public.profiles p
              where p.id = auth.uid()
                and lower(coalesce(p.role, '')) = 'admin'
            )
            or (
              exists (
                select 1
                from public.enrollments e
                where e.seminar_id = s.id
                  and e.student_id = auth.uid()
                  and lower(coalesce(e.payment_status, '')) = 'paid'
              )
              and (
                coalesce(s.materials_access_mode, 'start_date') = 'after_payment'
                or (s.start_date is not null and current_date >= s.start_date::date)
              )
            )
          )
        )
      )
  )
);

alter table public.seminar_materials enable row level security;

drop policy if exists seminar_materials_owner_select on public.seminar_materials;
create policy seminar_materials_owner_select
on public.seminar_materials
for select
to authenticated
using (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_materials.seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists seminar_materials_owner_insert on public.seminar_materials;
create policy seminar_materials_owner_insert
on public.seminar_materials
for insert
to authenticated
with check (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_materials.seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists seminar_materials_owner_update on public.seminar_materials;
create policy seminar_materials_owner_update
on public.seminar_materials
for update
to authenticated
using (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_materials.seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_materials.seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists seminar_materials_owner_delete on public.seminar_materials;
create policy seminar_materials_owner_delete
on public.seminar_materials
for delete
to authenticated
using (
  exists (
    select 1
    from public.seminars s
    where s.id = seminar_materials.seminar_id
      and (s.professor_id = auth.uid() or s.instructor_id = auth.uid())
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

insert into public.seminar_materials (
  seminar_id,
  title,
  description,
  material_type,
  external_url,
  youtube_video_id,
  mime_type,
  bucket,
  storage_path,
  sort_order
)
select
  s.id,
  coalesce(nullif(item->>'title', ''), nullif(item->>'name', ''), 'Material ' || ordinality),
  nullif(item->>'description', ''),
  case lower(coalesce(item->>'type', 'file'))
    when 'document' then 'file'
    when 'video' then case when coalesce(item->>'youtube_video_id', '') <> '' then 'youtube' else 'link' end
    when 'youtube' then 'youtube'
    when 'link' then 'link'
    else 'file'
  end,
  nullif(item->>'url', ''),
  nullif(item->>'youtube_video_id', ''),
  nullif(item->>'mime_type', ''),
  nullif(item->>'bucket', ''),
  coalesce(nullif(item->>'storage_path', ''), nullif(item->>'path', '')),
  greatest(ordinality - 1, 0)
from public.seminars s
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(coalesce(s.materials, '[]'::jsonb)) = 'array' then coalesce(s.materials, '[]'::jsonb)
    else '[]'::jsonb
  end
) with ordinality as m(item, ordinality)
where not exists (
  select 1
  from public.seminar_materials sm
  where sm.seminar_id = s.id
);

update public.seminars
set materials = '[]'::jsonb
where jsonb_typeof(coalesce(materials, '[]'::jsonb)) = 'array'
  and jsonb_array_length(coalesce(materials, '[]'::jsonb)) > 0;

create or replace function public.get_accessible_seminar_materials(
  p_seminar_id uuid
)
returns table (
  id uuid,
  title text,
  description text,
  type text,
  is_preview_public boolean,
  url text,
  youtube_video_id text,
  mime_type text,
  bucket text,
  path text,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_date date;
  v_access_mode text;
  v_is_owner boolean := false;
  v_is_admin boolean := false;
  v_is_paid boolean := false;
  v_has_full_access boolean := false;
begin
  select
    s.start_date::date,
    coalesce(s.materials_access_mode, 'start_date'),
    (s.professor_id = auth.uid() or s.instructor_id = auth.uid()),
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'admin'
    )
  into v_start_date, v_access_mode, v_is_owner, v_is_admin
  from public.seminars s
  where s.id = p_seminar_id;

  if not found then
    return;
  end if;

  if v_is_owner or v_is_admin then
    v_has_full_access := true;
  elsif auth.uid() is not null then
    select exists (
      select 1
      from public.enrollments e
      where e.seminar_id = p_seminar_id
        and e.student_id = auth.uid()
        and lower(coalesce(e.payment_status, '')) = 'paid'
    )
    into v_is_paid;

    if v_is_paid and (v_access_mode = 'after_payment' or (v_start_date is not null and current_date >= v_start_date)) then
      v_has_full_access := true;
    end if;
  end if;

  if v_has_full_access then
    return query
    select
      sm.id,
      sm.title,
      sm.description,
      sm.material_type as type,
      sm.is_preview_public,
      case
        when sm.material_type = 'file' then null
        else sm.external_url
      end as url,
      sm.youtube_video_id,
      sm.mime_type,
      sm.bucket,
      sm.storage_path as path,
      sm.sort_order
    from public.seminar_materials sm
    where sm.seminar_id = p_seminar_id
    order by sm.sort_order asc, sm.created_at asc, sm.id asc;
    return;
  end if;

  return query
  select
    sm.id,
    sm.title,
    sm.description,
    sm.material_type as type,
    sm.is_preview_public,
    case
      when sm.material_type = 'file' then null
      else sm.external_url
    end as url,
    sm.youtube_video_id,
    sm.mime_type,
    sm.bucket,
    sm.storage_path as path,
    sm.sort_order
  from public.seminar_materials sm
  where sm.seminar_id = p_seminar_id
    and sm.is_preview_public = true
  order by sm.sort_order asc, sm.created_at asc, sm.id asc;
end;
$$;

revoke execute on function public.get_accessible_seminar_materials(uuid) from public;
grant execute on function public.get_accessible_seminar_materials(uuid) to anon, authenticated;

commit;
