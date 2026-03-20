begin;

create table public.payment_methods (
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

create index payment_methods_enabled_sort_idx
  on public.payment_methods (enabled, sort_order, created_at);

create index payment_methods_provider_idx
  on public.payment_methods (provider);

create table public.payment_method_fields (
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

create index payment_method_fields_method_sort_idx
  on public.payment_method_fields (payment_method_id, enabled, sort_order, created_at);

alter table public.payment_methods enable row level security;
alter table public.payment_method_fields enable row level security;

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

create policy payment_method_fields_select_enabled
on public.payment_method_fields
for select
to authenticated
using (
  enabled = true
  and exists (
    select 1
    from public.payment_methods pm
    where pm.id = payment_method_id
      and pm.enabled = true
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

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
    '{
      "es": "Transferencia bancaria",
      "en": "Bank transfer",
      "fr": "Virement bancaire",
      "ht": "Transfe labank"
    }'::jsonb,
    '{
      "es": "Pago manual por cuenta bancaria.",
      "en": "Manual payment by bank account.",
      "fr": "Paiement manuel par compte bancaire.",
      "ht": "Peman manyèl pa kont labank."
    }'::jsonb,
    '{
      "es": "Comparte estos datos con el estudiante para que complete la transferencia.",
      "en": "Share these details with the student to complete the transfer.",
      "fr": "Partagez ces informations avec l''étudiant pour compléter le virement.",
      "ht": "Pataje detay sa yo ak etidyan an pou li fè transfè a."
    }'::jsonb,
    10
  ),
  (
    'paypal',
    'manual',
    'paypal',
    coalesce((select enable_paypal from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{
      "es": "PayPal",
      "en": "PayPal",
      "fr": "PayPal",
      "ht": "PayPal"
    }'::jsonb,
    '{
      "es": "Enlace de pago manual con PayPal.",
      "en": "Manual payment link with PayPal.",
      "fr": "Lien de paiement manuel avec PayPal.",
      "ht": "Lyen peman manyèl ak PayPal."
    }'::jsonb,
    '{
      "es": "Comparte el enlace del método con el estudiante.",
      "en": "Share the payment link with the student.",
      "fr": "Partagez le lien de paiement avec l''étudiant.",
      "ht": "Pataje lyen peman an ak etidyan an."
    }'::jsonb,
    20
  ),
  (
    'cash',
    'manual',
    'cash',
    coalesce((select enable_cash from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{
      "es": "Efectivo",
      "en": "Cash",
      "fr": "Espèces",
      "ht": "Lajan kach"
    }'::jsonb,
    '{
      "es": "Cobro manual en efectivo.",
      "en": "Manual cash collection.",
      "fr": "Encaissement manuel en espèces.",
      "ht": "Resevwa lajan kach manyèlman."
    }'::jsonb,
    '{
      "es": "Indica aquí el proceso que debe seguir el estudiante.",
      "en": "Explain here the steps the student must follow.",
      "fr": "Expliquez ici les étapes que l''étudiant doit suivre.",
      "ht": "Eksplike la a etap etidyan an dwe swiv yo."
    }'::jsonb,
    30
  ),
  (
    'card',
    'gateway',
    'card',
    coalesce((select enable_card from public.platform_settings where id = 1), false),
    array['es', 'en', 'fr', 'ht']::text[],
    '{
      "es": "Tarjeta",
      "en": "Card",
      "fr": "Carte",
      "ht": "Kat"
    }'::jsonb,
    '{
      "es": "Pasarela futura para pagos con tarjeta.",
      "en": "Future gateway for card payments.",
      "fr": "Passerelle future pour les paiements par carte.",
      "ht": "Pòtay peman kap vini pou kat."
    }'::jsonb,
    '{
      "es": "Método reservado para la integración de una pasarela.",
      "en": "Reserved method for a future gateway integration.",
      "fr": "Méthode réservée à une future intégration de passerelle.",
      "ht": "Metòd sa a rezève pou yon entegrasyon pòtay pita."
    }'::jsonb,
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
      '{"es":"Nombre del banco receptor.","en":"Receiving bank name.","fr":"Nom de la banque réceptrice.","ht":"Non bank k ap resevwa a."}'::jsonb,
      'text',
      coalesce((select bank_name from public.platform_settings where id = 1), ''),
      false,
      10
    ),
    (
      'transfer',
      'bank_account_name',
      '{"es":"Titular","en":"Account holder","fr":"Titulaire","ht":"Non moun sou kont la"}'::jsonb,
      '{"es":"Nombre del titular de la cuenta.","en":"Account holder name.","fr":"Nom du titulaire du compte.","ht":"Non moun ki sou kont la."}'::jsonb,
      'text',
      coalesce((select bank_account_name from public.platform_settings where id = 1), ''),
      false,
      20
    ),
    (
      'transfer',
      'bank_account_number',
      '{"es":"Número de cuenta","en":"Account number","fr":"Numéro de compte","ht":"Nimewo kont"}'::jsonb,
      '{"es":"Número o referencia principal.","en":"Main number or reference.","fr":"Numéro ou référence principale.","ht":"Nimewo oswa referans prensipal la."}'::jsonb,
      'text',
      coalesce((select bank_account_number from public.platform_settings where id = 1), ''),
      true,
      30
    ),
    (
      'transfer',
      'bank_iban',
      '{"es":"IBAN","en":"IBAN","fr":"IBAN","ht":"IBAN"}'::jsonb,
      '{"es":"Solo si aplica.","en":"Only if applicable.","fr":"Seulement si applicable.","ht":"Sèlman si sa aplikab."}'::jsonb,
      'text',
      coalesce((select bank_iban from public.platform_settings where id = 1), ''),
      true,
      40
    ),
    (
      'transfer',
      'bank_swift',
      '{"es":"SWIFT","en":"SWIFT","fr":"SWIFT","ht":"SWIFT"}'::jsonb,
      '{"es":"Útil para transferencias internacionales.","en":"Useful for international transfers.","fr":"Utile pour les virements internationaux.","ht":"Itil pou transfè entènasyonal."}'::jsonb,
      'text',
      coalesce((select bank_swift from public.platform_settings where id = 1), ''),
      true,
      50
    ),
    (
      'transfer',
      'bank_notes',
      '{"es":"Notas","en":"Notes","fr":"Notes","ht":"Nòt"}'::jsonb,
      '{"es":"Instrucciones adicionales.","en":"Additional instructions.","fr":"Instructions complémentaires.","ht":"Enstriksyon siplemantè."}'::jsonb,
      'textarea',
      coalesce((select bank_notes from public.platform_settings where id = 1), ''),
      false,
      60
    ),
    (
      'paypal',
      'paypal_link',
      '{"es":"Link PayPal","en":"PayPal link","fr":"Lien PayPal","ht":"Lyen PayPal"}'::jsonb,
      '{"es":"Enlace compartido con el estudiante.","en":"Link shared with the student.","fr":"Lien partagé avec l''étudiant.","ht":"Lyen pou pataje ak etidyan an."}'::jsonb,
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

select public.sync_legacy_platform_payment_settings();

commit;
