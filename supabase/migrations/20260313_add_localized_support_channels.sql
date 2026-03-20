begin;

alter table public.platform_settings
  add column if not exists support_whatsapp_feedback_link_i18n jsonb not null default '{}'::jsonb;

alter table public.platform_settings
  add column if not exists support_whatsapp_message_i18n jsonb not null default '{}'::jsonb;

alter table public.platform_settings
  add column if not exists support_facebook_forum_link_i18n jsonb not null default '{}'::jsonb;

alter table public.platform_settings
  add column if not exists support_whatsapp_channel_link_i18n jsonb not null default '{}'::jsonb;

alter table public.platform_settings
  add column if not exists support_email_i18n jsonb not null default '{}'::jsonb;

update public.platform_settings
set
  support_whatsapp_feedback_link_i18n = case
    when coalesce(support_whatsapp_feedback_link_i18n, '{}'::jsonb) = '{}'::jsonb then
      jsonb_build_object(
        'es', coalesce(support_whatsapp_feedback_link, ''),
        'en', coalesce(support_whatsapp_feedback_link, ''),
        'fr', coalesce(support_whatsapp_feedback_link, ''),
        'ht', coalesce(support_whatsapp_feedback_link, '')
      )
    else support_whatsapp_feedback_link_i18n
  end,
  support_whatsapp_message_i18n = case
    when coalesce(support_whatsapp_message_i18n, '{}'::jsonb) = '{}'::jsonb then
      jsonb_build_object(
        'es', coalesce(support_whatsapp_message, ''),
        'en', coalesce(support_whatsapp_message, ''),
        'fr', coalesce(support_whatsapp_message, ''),
        'ht', coalesce(support_whatsapp_message, '')
      )
    else support_whatsapp_message_i18n
  end,
  support_facebook_forum_link_i18n = case
    when coalesce(support_facebook_forum_link_i18n, '{}'::jsonb) = '{}'::jsonb then
      jsonb_build_object(
        'es', coalesce(support_facebook_forum_link, ''),
        'en', coalesce(support_facebook_forum_link, ''),
        'fr', coalesce(support_facebook_forum_link, ''),
        'ht', coalesce(support_facebook_forum_link, '')
      )
    else support_facebook_forum_link_i18n
  end,
  support_whatsapp_channel_link_i18n = case
    when coalesce(support_whatsapp_channel_link_i18n, '{}'::jsonb) = '{}'::jsonb then
      jsonb_build_object(
        'es', coalesce(support_whatsapp_channel_link, ''),
        'en', coalesce(support_whatsapp_channel_link, ''),
        'fr', coalesce(support_whatsapp_channel_link, ''),
        'ht', coalesce(support_whatsapp_channel_link, '')
      )
    else support_whatsapp_channel_link_i18n
  end,
  support_email_i18n = case
    when coalesce(support_email_i18n, '{}'::jsonb) = '{}'::jsonb then
      jsonb_build_object(
        'es', coalesce(support_email, ''),
        'en', coalesce(support_email, ''),
        'fr', coalesce(support_email, ''),
        'ht', coalesce(support_email, '')
      )
    else support_email_i18n
  end;

commit;
