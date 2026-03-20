begin;

create table if not exists public.payment_methods (
  id uuid not null default gen_random_uuid(),
  code text not null,
  kind text not null default 'manual',
  provider text not null default 'custom',
  enabled boolean not null default true,
  visible_languages text[] not null default '{}'::text[],
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  instructions_i18n jsonb not null default '{}'::jsonb,
  public_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_methods_pkey primary key (id),
  constraint payment_methods_code_key unique (code),
  constraint payment_methods_code_format_check check (code = lower(code) and code ~ '^[a-z0-9_]+$'),
  constraint payment_methods_kind_check check (kind in ('manual', 'gateway')),
  constraint payment_methods_provider_not_blank check (length(trim(provider)) > 0),
  constraint payment_methods_visible_languages_check check (
    visible_languages <@ array['es', 'en', 'fr', 'ht']::text[]
  )
);

create index if not exists payment_methods_enabled_sort_idx
  on public.payment_methods (enabled, sort_order, created_at);

create index if not exists payment_methods_provider_idx
  on public.payment_methods (provider);

create table if not exists public.payment_method_fields (
  id uuid not null default gen_random_uuid(),
  payment_method_id uuid not null references public.payment_methods (id) on delete cascade,
  field_key text not null,
  label_i18n jsonb not null default '{}'::jsonb,
  help_text_i18n jsonb not null default '{}'::jsonb,
  field_type text not null default 'text',
  field_value text null,
  copyable boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_method_fields_pkey primary key (id),
  constraint payment_method_fields_unique_key unique (payment_method_id, field_key),
  constraint payment_method_fields_key_format_check check (
    field_key = lower(field_key) and field_key ~ '^[a-z0-9_]+$'
  ),
  constraint payment_method_fields_type_check check (
    field_type in ('text', 'textarea', 'url', 'email', 'number')
  )
);

create index if not exists payment_method_fields_method_sort_idx
  on public.payment_method_fields (payment_method_id, enabled, sort_order, created_at);

alter table public.payment_methods enable row level security;
alter table public.payment_method_fields enable row level security;

drop policy if exists payment_methods_select_enabled on public.payment_methods;
create policy payment_methods_select_enabled
on public.payment_methods
for select
to authenticated
using (
  enabled = true
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_methods_admin_insert on public.payment_methods;
create policy payment_methods_admin_insert
on public.payment_methods
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_methods_admin_update on public.payment_methods;
create policy payment_methods_admin_update
on public.payment_methods
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_methods_admin_delete on public.payment_methods;
create policy payment_methods_admin_delete
on public.payment_methods
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_method_fields_select_enabled on public.payment_method_fields;
create policy payment_method_fields_select_enabled
on public.payment_method_fields
for select
to authenticated
using (
  (
    enabled = true
    and exists (
      select 1
      from public.payment_methods pm
      where pm.id = payment_method_id
        and pm.enabled = true
    )
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_method_fields_admin_insert on public.payment_method_fields;
create policy payment_method_fields_admin_insert
on public.payment_method_fields
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_method_fields_admin_update on public.payment_method_fields;
create policy payment_method_fields_admin_update
on public.payment_method_fields
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists payment_method_fields_admin_delete on public.payment_method_fields;
create policy payment_method_fields_admin_delete
on public.payment_method_fields
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop trigger if exists trg_payment_methods_set_updated_at on public.payment_methods;
create trigger trg_payment_methods_set_updated_at
before update on public.payment_methods
for each row
execute function public.set_updated_at();

drop trigger if exists trg_payment_method_fields_set_updated_at on public.payment_method_fields;
create trigger trg_payment_method_fields_set_updated_at
before update on public.payment_method_fields
for each row
execute function public.set_updated_at();

create or replace function public.sync_legacy_platform_payment_settings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_transfer_enabled boolean := false;
  v_bank_name text := '';
  v_bank_account_name text := '';
  v_bank_account_number text := '';
  v_bank_iban text := '';
  v_bank_swift text := '';
  v_bank_notes text := '';
  v_paypal_id uuid;
  v_paypal_enabled boolean := false;
  v_paypal_link text := '';
  v_card_enabled boolean := false;
  v_cash_enabled boolean := false;
begin
  select pm.id, pm.enabled
  into v_transfer_id, v_transfer_enabled
  from public.payment_methods pm
  where pm.provider = 'bank_transfer'
  order by pm.enabled desc, pm.sort_order asc, pm.created_at asc
  limit 1;

  if v_transfer_id is not null then
    select coalesce(pmf.field_value, '')
    into v_bank_name
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_name'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;

    select coalesce(pmf.field_value, '')
    into v_bank_account_name
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_account_name'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;

    select coalesce(pmf.field_value, '')
    into v_bank_account_number
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_account_number'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;

    select coalesce(pmf.field_value, '')
    into v_bank_iban
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_iban'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;

    select coalesce(pmf.field_value, '')
    into v_bank_swift
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_swift'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;

    select coalesce(pmf.field_value, '')
    into v_bank_notes
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_transfer_id
      and pmf.field_key = 'bank_notes'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;
  end if;

  select pm.id, pm.enabled
  into v_paypal_id, v_paypal_enabled
  from public.payment_methods pm
  where pm.provider = 'paypal'
  order by pm.enabled desc, pm.sort_order asc, pm.created_at asc
  limit 1;

  if v_paypal_id is not null then
    select coalesce(pmf.field_value, '')
    into v_paypal_link
    from public.payment_method_fields pmf
    where pmf.payment_method_id = v_paypal_id
      and pmf.field_key = 'paypal_link'
      and pmf.enabled = true
    order by pmf.sort_order asc, pmf.created_at asc
    limit 1;
  end if;

  select coalesce(pm.enabled, false)
  into v_card_enabled
  from public.payment_methods pm
  where pm.provider = 'card'
  order by pm.enabled desc, pm.sort_order asc, pm.created_at asc
  limit 1;

  select coalesce(pm.enabled, false)
  into v_cash_enabled
  from public.payment_methods pm
  where pm.provider = 'cash'
  order by pm.enabled desc, pm.sort_order asc, pm.created_at asc
  limit 1;

  insert into public.platform_settings (
    id,
    enable_transfer,
    enable_paypal,
    enable_card,
    enable_cash,
    bank_name,
    bank_account_name,
    bank_account_number,
    bank_iban,
    bank_swift,
    bank_notes,
    paypal_link
  )
  values (
    1,
    coalesce(v_transfer_enabled, false),
    coalesce(v_paypal_enabled, false),
    coalesce(v_card_enabled, false),
    coalesce(v_cash_enabled, false),
    coalesce(v_bank_name, ''),
    coalesce(v_bank_account_name, ''),
    coalesce(v_bank_account_number, ''),
    coalesce(v_bank_iban, ''),
    coalesce(v_bank_swift, ''),
    coalesce(v_bank_notes, ''),
    coalesce(v_paypal_link, '')
  )
  on conflict (id) do update set
    enable_transfer = excluded.enable_transfer,
    enable_paypal = excluded.enable_paypal,
    enable_card = excluded.enable_card,
    enable_cash = excluded.enable_cash,
    bank_name = excluded.bank_name,
    bank_account_name = excluded.bank_account_name,
    bank_account_number = excluded.bank_account_number,
    bank_iban = excluded.bank_iban,
    bank_swift = excluded.bank_swift,
    bank_notes = excluded.bank_notes,
    paypal_link = excluded.paypal_link;
end;
$$;

create or replace function public.handle_sync_legacy_platform_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_legacy_platform_payment_settings();
  return null;
end;
$$;

revoke execute on function public.sync_legacy_platform_payment_settings() from public, anon, authenticated;
revoke execute on function public.handle_sync_legacy_platform_payment_settings() from public, anon, authenticated;

drop trigger if exists trg_payment_methods_sync_legacy on public.payment_methods;
create trigger trg_payment_methods_sync_legacy
after insert or update or delete on public.payment_methods
for each statement
execute function public.handle_sync_legacy_platform_payment_settings();

drop trigger if exists trg_payment_method_fields_sync_legacy on public.payment_method_fields;
create trigger trg_payment_method_fields_sync_legacy
after insert or update or delete on public.payment_method_fields
for each statement
execute function public.handle_sync_legacy_platform_payment_settings();

insert into public.payment_methods (
  code,
  kind,
  provider,
  enabled,
  visible_languages,
  title_i18n,
  description_i18n,
  instructions_i18n,
  sort_order
)
values
  (
    'transfer',
    'manual',
    'bank_transfer',
    coalesce((select enable_transfer from public.platform_settings where id = 1), true),
    array['es', 'en', 'fr', 'ht']::text[],
    '{"es":"Transferencia bancaria","en":"Bank transfer","fr":"Virement bancaire","ht":"Transfe labank"}'::jsonb,
    '{"es":"Pago manual por cuenta bancaria.","en":"Manual payment by bank account.","fr":"Paiement manuel par compte bancaire.","ht":"Peman manyel pa kont labank."}'::jsonb,
    '{"es":"Comparte estos datos con el estudiante para que complete la transferencia.","en":"Share these details with the student to complete the transfer.","fr":"Partagez ces informations avec l''etudiant pour completer le virement.","ht":"Pataje detay sa yo ak etidyan an pou li fe transf a."}'::jsonb,
    10
  ),
  (
    'paypal',
    'manual',
    'paypal',
    coalesce((select enable_paypal from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{"es":"PayPal","en":"PayPal","fr":"PayPal","ht":"PayPal"}'::jsonb,
    '{"es":"Enlace de pago manual con PayPal.","en":"Manual payment link with PayPal.","fr":"Lien de paiement manuel avec PayPal.","ht":"Lyen peman manyel ak PayPal."}'::jsonb,
    '{"es":"Comparte el enlace del metodo con el estudiante.","en":"Share the payment link with the student.","fr":"Partagez le lien de paiement avec l''etudiant.","ht":"Pataje lyen peman an ak etidyan an."}'::jsonb,
    20
  ),
  (
    'cash',
    'manual',
    'cash',
    coalesce((select enable_cash from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{"es":"Efectivo","en":"Cash","fr":"Especes","ht":"Lajan kach"}'::jsonb,
    '{"es":"Cobro manual en efectivo.","en":"Manual cash collection.","fr":"Encaissement manuel en especes.","ht":"Resevwa lajan kach manyelman."}'::jsonb,
    '{"es":"Indica aqui el proceso que debe seguir el estudiante.","en":"Explain here the steps the student must follow.","fr":"Expliquez ici les etapes que l''etudiant doit suivre.","ht":"Eksplike la etap etidyan an dwe swiv yo."}'::jsonb,
    30
  ),
  (
    'card',
    'gateway',
    'card',
    coalesce((select enable_card from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{"es":"Tarjeta","en":"Card","fr":"Carte","ht":"Kat"}'::jsonb,
    '{"es":"Pasarela futura para pagos con tarjeta.","en":"Future gateway for card payments.","fr":"Passerelle future pour les paiements par carte.","ht":"Potay peman kap vini pou kat."}'::jsonb,
    '{"es":"Metodo reservado para la integracion de una pasarela.","en":"Reserved method for a future gateway integration.","fr":"Methode reservee a une future integration de passerelle.","ht":"Metod sa a rezeve pou yon entegrasyon potay pita."}'::jsonb,
    40
  )
on conflict (code) do update set
  kind = excluded.kind,
  provider = excluded.provider,
  enabled = excluded.enabled,
  visible_languages = excluded.visible_languages,
  title_i18n = excluded.title_i18n,
  description_i18n = excluded.description_i18n,
  instructions_i18n = excluded.instructions_i18n,
  sort_order = excluded.sort_order;

insert into public.payment_method_fields (
  payment_method_id,
  field_key,
  label_i18n,
  help_text_i18n,
  field_type,
  field_value,
  copyable,
  sort_order
)
select
  pm.id,
  seed.field_key,
  seed.label_i18n,
  seed.help_text_i18n,
  seed.field_type,
  seed.field_value,
  seed.copyable,
  seed.sort_order
from public.payment_methods pm
join (
  values
    (
      'transfer',
      'bank_name',
      '{"es":"Banco","en":"Bank","fr":"Banque","ht":"Bank"}'::jsonb,
      '{"es":"Nombre del banco receptor.","en":"Receiving bank name.","fr":"Nom de la banque receptrice.","ht":"Non bank k ap resevwa a."}'::jsonb,
      'text',
      coalesce((select bank_name from public.platform_settings where id = 1), ''),
      false,
      10
    ),
    (
      'transfer',
      'bank_account_name',
      '{"es":"Titular","en":"Account holder","fr":"Titulaire","ht":"Moun sou kont la"}'::jsonb,
      '{"es":"Nombre del titular de la cuenta.","en":"Account holder name.","fr":"Nom du titulaire du compte.","ht":"Non moun ki sou kont la."}'::jsonb,
      'text',
      coalesce((select bank_account_name from public.platform_settings where id = 1), ''),
      false,
      20
    ),
    (
      'transfer',
      'bank_account_number',
      '{"es":"Numero de cuenta","en":"Account number","fr":"Numero de compte","ht":"Nimewo kont"}'::jsonb,
      '{"es":"Numero o referencia principal.","en":"Main number or reference.","fr":"Numero ou reference principale.","ht":"Nimewo oswa referans prensipal la."}'::jsonb,
      'text',
      coalesce((select bank_account_number from public.platform_settings where id = 1), ''),
      true,
      30
    ),
    (
      'transfer',
      'bank_iban',
      '{"es":"IBAN","en":"IBAN","fr":"IBAN","ht":"IBAN"}'::jsonb,
      '{"es":"Solo si aplica.","en":"Only if applicable.","fr":"Seulement si applicable.","ht":"Selman si sa aplikab."}'::jsonb,
      'text',
      coalesce((select bank_iban from public.platform_settings where id = 1), ''),
      true,
      40
    ),
    (
      'transfer',
      'bank_swift',
      '{"es":"SWIFT","en":"SWIFT","fr":"SWIFT","ht":"SWIFT"}'::jsonb,
      '{"es":"Util para transferencias internacionales.","en":"Useful for international transfers.","fr":"Utile pour les virements internationaux.","ht":"Itil pou transf enternasyonal."}'::jsonb,
      'text',
      coalesce((select bank_swift from public.platform_settings where id = 1), ''),
      true,
      50
    ),
    (
      'transfer',
      'bank_notes',
      '{"es":"Notas","en":"Notes","fr":"Notes","ht":"Not"}'::jsonb,
      '{"es":"Instrucciones adicionales.","en":"Additional instructions.","fr":"Instructions complementaires.","ht":"Enstriksyon siplemante."}'::jsonb,
      'textarea',
      coalesce((select bank_notes from public.platform_settings where id = 1), ''),
      false,
      60
    ),
    (
      'paypal',
      'paypal_link',
      '{"es":"Link PayPal","en":"PayPal link","fr":"Lien PayPal","ht":"Lyen PayPal"}'::jsonb,
      '{"es":"Enlace compartido con el estudiante.","en":"Link shared with the student.","fr":"Lien partage avec l''etudiant.","ht":"Lyen pou pataje ak etidyan an."}'::jsonb,
      'url',
      coalesce((select paypal_link from public.platform_settings where id = 1), ''),
      true,
      10
    )
) as seed(
  method_code,
  field_key,
  label_i18n,
  help_text_i18n,
  field_type,
  field_value,
  copyable,
  sort_order
) on seed.method_code = pm.code
on conflict (payment_method_id, field_key) do update set
  label_i18n = excluded.label_i18n,
  help_text_i18n = excluded.help_text_i18n,
  field_type = excluded.field_type,
  field_value = excluded.field_value,
  copyable = excluded.copyable,
  sort_order = excluded.sort_order;

alter table public.enrollments
  add column if not exists payment_method_code text null,
  add column if not exists payment_method_title text null,
  add column if not exists payment_method_provider text null,
  add column if not exists payment_submitted_at timestamp with time zone null,
  add column if not exists payment_method_snapshot jsonb null;

create or replace function public.get_santo_domingo_today()
returns date
language sql
stable
set search_path = public
as $$
  select timezone('America/Santo_Domingo', now())::date;
$$;

create or replace function public.get_payment_window_days()
returns table (
  payment_open_days integer,
  payment_close_days integer
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_settings jsonb;
  v_open integer := 7;
  v_close integer := 2;
begin
  select to_jsonb(ps)
  into v_settings
  from public.platform_settings ps
  limit 1;

  if v_settings is not null then
    begin
      v_open := greatest(0, round(coalesce((v_settings ->> 'payment_open_days')::numeric, 7))::integer);
    exception
      when others then
        v_open := 7;
    end;

    begin
      v_close := greatest(0, round(coalesce((v_settings ->> 'payment_close_days')::numeric, 2))::integer);
    exception
      when others then
        v_close := 2;
    end;
  end if;

  payment_open_days := greatest(v_open, v_close);
  payment_close_days := least(v_open, v_close);
  return next;
end;
$$;

create or replace function public.get_payment_window_state(
  p_seminar_id uuid
)
returns table (
  payment_open_date date,
  payment_close_date date,
  current_local_date date,
  active_enrollment_count integer,
  max_students integer,
  is_full boolean,
  is_payment_window_open boolean,
  is_payment_window_closed boolean,
  can_pay boolean,
  is_enrollment_closed boolean
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_start_date date;
  v_open_days integer := 7;
  v_close_days integer := 2;
begin
  select s.start_date::date, coalesce(s.max_students, 0)::integer
  into v_start_date, max_students
  from public.seminars s
  where s.id = p_seminar_id
  limit 1;

  if not found then
    return;
  end if;

  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  payment_open_date := v_start_date - v_open_days;
  payment_close_date := v_start_date - v_close_days;
  current_local_date := public.get_santo_domingo_today();

  select count(*)::integer
  into active_enrollment_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) <> 'cancelled';

  is_full := max_students > 0 and active_enrollment_count >= max_students;
  is_payment_window_open :=
    payment_open_date is not null
    and payment_close_date is not null
    and current_local_date >= payment_open_date
    and current_local_date <= payment_close_date;
  is_payment_window_closed :=
    payment_close_date is not null
    and current_local_date > payment_close_date;
  can_pay := not is_payment_window_closed and (is_full or is_payment_window_open);
  is_enrollment_closed := is_full or is_payment_window_open or is_payment_window_closed;

  return next;
end;
$$;

drop trigger if exists enrollments_block_on_payment_window on public.enrollments;
drop function if exists public.submit_enrollment_payment(uuid, text, text);
drop function if exists public.pay_enrollment(uuid);
drop function if exists public.block_enrollment_when_payments_open();
drop function if exists public.quote_price(uuid);

create or replace function public.quote_price(
  p_seminar_id uuid
)
returns table (
  can_pay boolean,
  reason text,
  estimated_price_now numeric,
  payment_due_date date,
  enrollment_count integer,
  paid_count integer,
  pending_count integer,
  target_students integer,
  target_income numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_open_days integer := 7;
  v_close_days integer := 2;
  v_current_local_date date;
  v_active_enrollment_count integer := 0;
  v_paid_count integer := 0;
  v_pending_count integer := 0;
  v_price_now numeric;
  v_target_income numeric := 0;
  v_target_students integer := 0;
  v_payment_open_date date;
  v_payment_close_date date;
  v_is_payment_window_open boolean := false;
  v_is_payment_window_closed boolean := false;
  v_is_full boolean := false;
begin
  select *
  into s
  from public.seminars
  where id = p_seminar_id
  limit 1;

  if not found then
    raise exception 'Seminar not found';
  end if;

  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  v_payment_open_date := s.start_date::date - v_open_days;
  v_payment_close_date := s.start_date::date - v_close_days;
  payment_due_date := v_payment_close_date;
  v_current_local_date := public.get_santo_domingo_today();

  select count(*)::integer
  into v_active_enrollment_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) not in ('cancelled', 'expired');

  select count(*)::integer
  into v_paid_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) = 'paid';

  select count(*)::integer
  into v_pending_count
  from public.enrollments e
  where e.seminar_id = p_seminar_id
    and lower(coalesce(e.status, '')) <> 'cancelled'
    and lower(coalesce(e.payment_status, '')) = 'pending_payment';

  enrollment_count := v_active_enrollment_count;
  paid_count := v_paid_count;
  pending_count := v_pending_count;

  v_target_income := coalesce(s.target_income, 0);
  v_target_students := coalesce(s.target_students, 0);
  target_income := v_target_income;
  target_students := v_target_students;

  if v_target_income > 0 and v_target_students > 0 then
    v_price_now := round(
      (v_target_income / least(v_target_students, greatest(1, v_active_enrollment_count)))::numeric,
      2
    );
  else
    v_price_now := coalesce(s.price, 0);
  end if;

  if v_payment_open_date is not null
     and v_current_local_date >= v_payment_open_date
     and s.payment_locked_at is null
  then
    update public.seminars
    set payment_locked_price = v_price_now,
        payment_locked_count = v_active_enrollment_count,
        payment_locked_at = now()
    where id = p_seminar_id;

    s.payment_locked_price := v_price_now;
  end if;

  estimated_price_now := coalesce(s.payment_locked_price, v_price_now);
  v_is_payment_window_open :=
    v_payment_open_date is not null
    and v_payment_close_date is not null
    and v_current_local_date >= v_payment_open_date
    and v_current_local_date <= v_payment_close_date;
  v_is_payment_window_closed :=
    v_payment_close_date is not null
    and v_current_local_date > v_payment_close_date;
  v_is_full := coalesce(s.max_students, 0) > 0 and v_active_enrollment_count >= coalesce(s.max_students, 0);
  can_pay := not v_is_payment_window_closed and (v_is_full or v_is_payment_window_open);

  if can_pay then
    reason := null;
  else
    reason := 'Payment not allowed yet (target/date rule)';
  end if;

  return next;
end;
$$;

create or replace function public.block_enrollment_when_payments_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state record;
begin
  select *
  into v_state
  from public.get_payment_window_state(new.seminar_id)
  limit 1;

  if coalesce(v_state.is_enrollment_closed, false) then
    raise exception 'Inscripciones cerradas: ventana de pagos abierta o cerrada';
  end if;

  return new;
end;
$$;

create trigger enrollments_block_on_payment_window
before insert on public.enrollments
for each row
execute function public.block_enrollment_when_payments_open();

create or replace function public.pay_enrollment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  s record;
  q record;
  due_date date;
  price numeric;
  v_actor_id uuid := auth.uid();
  v_state record;
begin
  if v_actor_id is null then
    raise exception 'Not allowed';
  end if;

  select *
  into e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  if e.student_id is distinct from v_actor_id then
    raise exception 'Not allowed';
  end if;

  if lower(coalesce(trim(e.payment_status), 'unpaid')) not in ('unpaid', 'rejected') then
    raise exception 'Enrollment is not payable';
  end if;

  select *
  into s
  from public.seminars
  where id = e.seminar_id
  limit 1;

  if not found then
    raise exception 'Seminar not found';
  end if;

  select *
  into v_state
  from public.get_payment_window_state(e.seminar_id)
  limit 1;

  if coalesce(v_state.can_pay, false) is not true then
    raise exception 'Ventana de pago cerrada';
  end if;

  select *
  into q
  from public.quote_price(e.seminar_id)
  limit 1;

  if q.estimated_price_now is null or q.estimated_price_now <= 0 then
    raise exception 'Cannot compute a valid price (target_income/price missing)';
  end if;

  price := q.estimated_price_now;
  due_date := q.payment_due_date;

  if due_date is null then
    due_date := v_state.payment_close_date;
  end if;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.seminar_id = e.seminar_id
      and wt.user_id = e.student_id
      and wt.type = 'seminar_payment'
      and wt.status = 'pending'
  ) then
    raise exception 'Pending payment already exists';
  end if;

  update public.enrollments
  set payment_status = 'pending_payment',
      payment_due_date = due_date,
      final_price = price
  where id = p_enrollment_id;

  insert into public.wallet_transactions (
    user_id,
    user_email,
    amount,
    type,
    description,
    status,
    seminar_id
  ) values (
    e.student_id,
    e.student_email,
    price,
    'seminar_payment',
    'Pago de seminario (pendiente de aprobacion)',
    'pending',
    e.seminar_id
  );
end;
$$;

create or replace function public.process_payment_window_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_log_id uuid;
  v_title text;
  v_body text;
  v_link text;
  v_open_days integer := 7;
  v_close_days integer := 2;
  v_today date := public.get_santo_domingo_today();
begin
  select pwd.payment_open_days, pwd.payment_close_days
  into v_open_days, v_close_days
  from public.get_payment_window_days() pwd;

  for rec in
    select
      e.id as enrollment_id,
      e.student_id,
      e.student_email,
      e.seminar_id,
      s.title,
      (s.start_date::date - v_open_days) as payment_open_date,
      (s.start_date::date - v_close_days) as payment_close_date
    from public.enrollments e
    join public.seminars s on s.id = e.seminar_id
    where s.start_date is not null
      and lower(coalesce(e.payment_status, '')) in ('unpaid', 'rejected')
  loop
    v_link := '/process-payment?enrollment_id=' || rec.enrollment_id;

    if rec.payment_open_date = v_today then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_open',
        rec.payment_open_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Pagos abiertos';
        v_body := rec.title || '. Ya puedes pagar y la ventana cierra el ' || to_char(rec.payment_close_date, 'YYYY-MM-DD') || '.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'info', v_link);
      end if;
    end if;

    if rec.payment_close_date = v_today then
      v_log_id := null;

      insert into public.payment_window_notification_log (
        enrollment_id,
        seminar_id,
        user_id,
        email,
        event_type,
        scheduled_for
      ) values (
        rec.enrollment_id,
        rec.seminar_id,
        rec.student_id,
        rec.student_email,
        'payment_close',
        rec.payment_close_date
      )
      on conflict do nothing
      returning id into v_log_id;

      if v_log_id is not null then
        v_title := 'Ultimo dia para pagar';
        v_body := rec.title || '. Hoy cierra tu ventana de pago.';
        perform public.notify_user_or_email(rec.student_id, rec.student_email, v_title, v_body, 'warning', v_link);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.expire_unpaid_enrollments()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seminar_id uuid;
  v_close_days integer := 2;
  v_today date := public.get_santo_domingo_today();
begin
  select pwd.payment_close_days
  into v_close_days
  from public.get_payment_window_days() pwd;

  update public.enrollments e
  set payment_status = 'expired',
      status = 'cancelled'
  from public.seminars s
  where e.seminar_id = s.id
    and coalesce(e.payment_status, '') in ('unpaid', 'pending_payment', 'rejected', '')
    and v_today > (s.start_date::date - v_close_days);

  for v_seminar_id in
    select distinct wt.seminar_id
    from public.wallet_transactions wt
    join public.seminars s on s.id = wt.seminar_id
    where wt.type = 'referral_bonus'
      and wt.status = 'held'
      and v_today > (s.start_date::date - v_close_days)
  loop
    perform public.forfeit_held_referral_bonuses_for_seminar(v_seminar_id);
  end loop;
end;
$$;

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

revoke execute on function public.get_santo_domingo_today() from public, anon, authenticated;
revoke execute on function public.get_payment_window_days() from public, anon, authenticated;
revoke execute on function public.get_payment_window_state(uuid) from public, anon, authenticated;
revoke execute on function public.sync_legacy_platform_payment_settings() from public, anon, authenticated;
revoke execute on function public.handle_sync_legacy_platform_payment_settings() from public, anon, authenticated;
revoke execute on function public.quote_price(uuid) from public, anon;
grant execute on function public.quote_price(uuid) to authenticated;
revoke execute on function public.submit_enrollment_payment(uuid, text, text) from public, anon;
grant execute on function public.submit_enrollment_payment(uuid, text, text) to authenticated;

select public.sync_legacy_platform_payment_settings();

commit;
