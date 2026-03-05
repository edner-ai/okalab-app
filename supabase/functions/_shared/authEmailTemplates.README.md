## Auth Email Templates

These templates are intended for a Supabase `Send Email Hook` with Resend.

Implemented template types:

- `confirm_signup`
- `invite_user`
- `magic_link`
- `reset_password`

Supabase auth event mapping:

- `signup` -> `confirm_signup`
- `invite` -> `invite_user`
- `magiclink` -> `magic_link`
- `recovery` -> `reset_password`

Supported locales:

- `es`
- `en`
- `fr`
- `ht`

Recommended locale source order:

1. `user.user_metadata.preferred_language`
2. `user.user_metadata.locale`
3. `es`

Renderer entry point:

- `supabase/functions/_shared/authEmailTemplates.ts`

The renderer expects:

- `type`
- `locale`
- `appName`
- `logoUrl`
- `actionUrl`
- `supportUrl`

and returns:

- `subject`
- `html`
- `text`
