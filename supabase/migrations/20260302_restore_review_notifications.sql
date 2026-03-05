begin;

create or replace function public.handle_review_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof uuid;
  v_title text;
begin
  select coalesce(professor_id, instructor_id), title
  into v_prof, v_title
  from public.seminars
  where id = new.seminar_id;

  perform public.notify_user(v_prof, 'Nueva resena', v_title, 'info', '/seminars/' || new.seminar_id);
  return new;
end;
$$;

drop trigger if exists trg_review_notifications on public.seminar_reviews;

create trigger trg_review_notifications
after insert on public.seminar_reviews
for each row
execute function public.handle_review_notifications();

revoke execute on function public.handle_review_notifications() from public, anon, authenticated;

commit;
