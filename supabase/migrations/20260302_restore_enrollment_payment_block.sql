begin;

create or replace function public.block_enrollment_when_payments_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
begin
  select *
  into q
  from public.quote_price(new.seminar_id)
  limit 1;

  if q.is_payment_window_open
     or (q.payment_close_date is not null and current_date > q.payment_close_date)
  then
    raise exception 'Inscripciones cerradas: ventana de pagos abierta o cerrada';
  end if;

  return new;
end;
$$;

drop trigger if exists enrollments_block_on_payment_window on public.enrollments;

create trigger enrollments_block_on_payment_window
before insert on public.enrollments
for each row
execute function public.block_enrollment_when_payments_open();

revoke execute on function public.block_enrollment_when_payments_open() from public, anon, authenticated;

commit;
