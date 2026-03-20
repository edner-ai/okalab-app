begin;

alter table public.enrollments
  add column if not exists payment_method_code text null,
  add column if not exists payment_method_title text null,
  add column if not exists payment_method_provider text null,
  add column if not exists payment_submitted_at timestamp with time zone null,
  add column if not exists payment_method_snapshot jsonb null;

create or replace function public.submit_enrollment_payment(
  p_enrollment_id uuid,
  p_payment_method_code text,
  p_payment_language text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  v_payment_method record;
  v_method_code text := lower(trim(coalesce(p_payment_method_code, '')));
  v_payment_language text := lower(trim(coalesce(p_payment_language, '')));
  v_method_title text;
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not allowed';
  end if;

  if v_method_code = '' then
    raise exception 'Payment method is required';
  end if;

  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  limit 1;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  select method_row.*
  into v_payment_method
  from public.payment_methods method_row
  where method_row.code = v_method_code
    and method_row.enabled = true
  limit 1;

  if not found then
    raise exception 'Payment method not available';
  end if;

  if array_length(v_payment_method.visible_languages, 1) is not null
     and array_length(v_payment_method.visible_languages, 1) > 0
     and v_payment_language <> ''
     and not (v_payment_language = any(v_payment_method.visible_languages))
  then
    raise exception 'Payment method not available for this language';
  end if;

  if lower(coalesce(v_payment_method.provider, '')) = 'card' then
    raise exception 'Payment method not supported yet';
  end if;

  v_method_title := coalesce(
    nullif(v_payment_method.title_i18n ->> v_payment_language, ''),
    nullif(v_payment_method.title_i18n ->> 'es', ''),
    nullif(v_payment_method.title_i18n ->> 'en', ''),
    nullif(v_payment_method.title_i18n ->> 'fr', ''),
    nullif(v_payment_method.title_i18n ->> 'ht', ''),
    v_payment_method.code
  );

  select jsonb_build_object(
    'id', v_payment_method.id,
    'code', v_payment_method.code,
    'kind', v_payment_method.kind,
    'provider', v_payment_method.provider,
    'visible_languages', v_payment_method.visible_languages,
    'title_i18n', v_payment_method.title_i18n,
    'description_i18n', v_payment_method.description_i18n,
    'instructions_i18n', v_payment_method.instructions_i18n,
    'public_config', v_payment_method.public_config,
    'fields',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'field_key', pmf.field_key,
              'label_i18n', pmf.label_i18n,
              'help_text_i18n', pmf.help_text_i18n,
              'field_type', pmf.field_type,
              'field_value', pmf.field_value,
              'copyable', pmf.copyable,
              'enabled', pmf.enabled,
              'sort_order', pmf.sort_order
            )
            order by pmf.sort_order, pmf.created_at
          )
          from public.payment_method_fields pmf
          where pmf.payment_method_id = v_payment_method.id
            and pmf.enabled = true
        ),
        '[]'::jsonb
      )
  )
  into v_snapshot;

  perform public.pay_enrollment(p_enrollment_id);

  update public.enrollments
  set payment_method_code = v_payment_method.code,
      payment_method_title = v_method_title,
      payment_method_provider = v_payment_method.provider,
      payment_submitted_at = now(),
      payment_method_snapshot = v_snapshot
  where id = p_enrollment_id;

  update public.wallet_transactions wt
  set description = left(
    'Pago de seminario (pendiente de aprobacion) - ' || coalesce(v_method_title, v_payment_method.code),
    240
  )
  where wt.seminar_id = e.seminar_id
    and wt.user_id = e.student_id
    and wt.type = 'seminar_payment'
    and wt.status = 'pending';
end;
$$;

revoke execute on function public.submit_enrollment_payment(uuid, text, text) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text) to authenticated;

commit;
