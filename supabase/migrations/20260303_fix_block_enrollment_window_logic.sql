begin;

create or replace function public.block_enrollment_when_payments_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  v_close_date date;
begin
  select *
  into q
  from public.quote_price(new.seminar_id)
  limit 1;

  select (s.start_date::date - ps.payment_close_days)
  into v_close_date
  from public.seminars s
  cross join public.platform_settings ps
  where s.id = new.seminar_id
  limit 1;

  if coalesce(q.can_pay, false)
     or (v_close_date is not null and current_date > v_close_date)
  then
    raise exception 'Inscripciones cerradas: ventana de pagos abierta o cerrada';
  end if;

  return new;
end;
$$;

revoke execute on function public.block_enrollment_when_payments_open() from public, anon, authenticated;

commit;
