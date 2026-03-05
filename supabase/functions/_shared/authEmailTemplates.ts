export type SupportedLocale = "es" | "en" | "fr" | "ht";

export type AuthEmailTemplateType =
  | "confirm_signup"
  | "invite_user"
  | "magic_link"
  | "reset_password";

export type RenderAuthEmailParams = {
  type: AuthEmailTemplateType;
  locale?: string | null;
  appName?: string | null;
  logoUrl?: string | null;
  actionUrl: string;
  supportUrl?: string | null;
};

type TemplateCopy = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  cta: string;
  note: string;
  footer: string;
};

const DEFAULT_APP_NAME = "Okalab";

export const SUPABASE_AUTH_EMAIL_TYPE_MAP: Record<string, AuthEmailTemplateType> = {
  signup: "confirm_signup",
  invite: "invite_user",
  magiclink: "magic_link",
  recovery: "reset_password",
};

const TEMPLATE_COPY: Record<SupportedLocale, Record<AuthEmailTemplateType, TemplateCopy>> = {
  es: {
    confirm_signup: {
      subject: "Confirma tu cuenta",
      eyebrow: "Confirmacion de cuenta",
      title: "Activa tu cuenta en Okalab",
      intro: "Confirma tu correo para empezar a aprender, colaborar y ganar dentro del ecosistema Okalab.",
      cta: "Confirmar cuenta",
      note: "Si no creaste esta cuenta, puedes ignorar este mensaje.",
      footer: "Este correo fue enviado automaticamente por Okalab.",
    },
    invite_user: {
      subject: "Te invitaron a Okalab",
      eyebrow: "Invitacion",
      title: "Ya tienes una invitacion lista",
      intro: "Acepta la invitacion para crear tu acceso y entrar a Okalab con el rol que prepararon para ti.",
      cta: "Aceptar invitacion",
      note: "Si no esperabas esta invitacion, no necesitas hacer nada.",
      footer: "Este correo fue enviado automaticamente por Okalab.",
    },
    magic_link: {
      subject: "Tu acceso rapido",
      eyebrow: "Magic link",
      title: "Entra a Okalab sin escribir tu clave",
      intro: "Usa este enlace seguro para iniciar sesion directamente en tu cuenta.",
      cta: "Entrar a Okalab",
      note: "Si no solicitaste este acceso, ignora este mensaje.",
      footer: "Este correo fue enviado automaticamente por Okalab.",
    },
    reset_password: {
      subject: "Restablece tu contrasena",
      eyebrow: "Seguridad",
      title: "Cambia tu contrasena",
      intro: "Recibimos una solicitud para restablecer la contrasena de tu cuenta. Usa el boton de abajo para continuar.",
      cta: "Restablecer contrasena",
      note: "Si no solicitaste este cambio, ignora este correo y tu acceso seguira igual.",
      footer: "Este correo fue enviado automaticamente por Okalab.",
    },
  },
  en: {
    confirm_signup: {
      subject: "Confirm your account",
      eyebrow: "Account confirmation",
      title: "Activate your Okalab account",
      intro: "Confirm your email to start learning, collaborating, and earning inside the Okalab ecosystem.",
      cta: "Confirm account",
      note: "If you did not create this account, you can ignore this email.",
      footer: "This email was sent automatically by Okalab.",
    },
    invite_user: {
      subject: "You were invited to Okalab",
      eyebrow: "Invitation",
      title: "Your invitation is ready",
      intro: "Accept this invitation to create your access and enter Okalab with the role prepared for you.",
      cta: "Accept invitation",
      note: "If you were not expecting this invitation, you can safely ignore it.",
      footer: "This email was sent automatically by Okalab.",
    },
    magic_link: {
      subject: "Your instant access link",
      eyebrow: "Magic link",
      title: "Sign in without your password",
      intro: "Use this secure link to sign in directly to your Okalab account.",
      cta: "Sign in to Okalab",
      note: "If you did not request this link, just ignore this email.",
      footer: "This email was sent automatically by Okalab.",
    },
    reset_password: {
      subject: "Reset your password",
      eyebrow: "Security",
      title: "Choose a new password",
      intro: "We received a request to reset your password. Use the button below to continue.",
      cta: "Reset password",
      note: "If you did not request this change, ignore this email and your password will remain unchanged.",
      footer: "This email was sent automatically by Okalab.",
    },
  },
  fr: {
    confirm_signup: {
      subject: "Confirmez votre compte",
      eyebrow: "Confirmation du compte",
      title: "Activez votre compte Okalab",
      intro: "Confirmez votre email pour commencer a apprendre, collaborer et gagner dans l'ecosysteme Okalab.",
      cta: "Confirmer le compte",
      note: "Si vous n'avez pas cree ce compte, vous pouvez ignorer cet email.",
      footer: "Cet email a ete envoye automatiquement par Okalab.",
    },
    invite_user: {
      subject: "Vous etes invite sur Okalab",
      eyebrow: "Invitation",
      title: "Votre invitation est prete",
      intro: "Acceptez cette invitation pour creer votre acces et entrer sur Okalab avec le role prepare pour vous.",
      cta: "Accepter l'invitation",
      note: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.",
      footer: "Cet email a ete envoye automatiquement par Okalab.",
    },
    magic_link: {
      subject: "Votre lien d'acces rapide",
      eyebrow: "Magic link",
      title: "Connectez-vous sans mot de passe",
      intro: "Utilisez ce lien securise pour acceder directement a votre compte Okalab.",
      cta: "Entrer sur Okalab",
      note: "Si vous n'avez pas demande ce lien, ignorez simplement cet email.",
      footer: "Cet email a ete envoye automatiquement par Okalab.",
    },
    reset_password: {
      subject: "Reinitialisez votre mot de passe",
      eyebrow: "Securite",
      title: "Choisissez un nouveau mot de passe",
      intro: "Nous avons recu une demande de reinitialisation de votre mot de passe. Utilisez le bouton ci-dessous pour continuer.",
      cta: "Reinitialiser le mot de passe",
      note: "Si vous n'avez pas demande ce changement, ignorez cet email et votre mot de passe restera le meme.",
      footer: "Cet email a ete envoye automatiquement par Okalab.",
    },
  },
  ht: {
    confirm_signup: {
      subject: "Konfime kont ou",
      eyebrow: "Konfimasyon kont",
      title: "Aktive kont Okalab ou",
      intro: "Konfime email ou pou komanse aprann, kolabore ak touche nan ekosistem Okalab la.",
      cta: "Konfime kont lan",
      note: "Si se pa ou ki te kreye kont sa a, ou ka inyore mesaj sa a.",
      footer: "Imel sa a te voye otomatikman pa Okalab.",
    },
    invite_user: {
      subject: "Yo envite ou sou Okalab",
      eyebrow: "Envitasyon",
      title: "Envitasyon ou pare",
      intro: "Aksepte envitasyon sa a pou kreye aks ou epi antre sou Okalab ak wol yo te prepare pou ou a.",
      cta: "Aksepte envitasyon an",
      note: "Si ou pa t ap tann envitasyon sa a, ou ka inyore imel sa a.",
      footer: "Imel sa a te voye otomatikman pa Okalab.",
    },
    magic_link: {
      subject: "Lyen akses rapid ou",
      eyebrow: "Magic link",
      title: "Antre san ou pa tape modpas ou",
      intro: "Svi ak lyen sa a pou konekte dirak nan kont Okalab ou.",
      cta: "Antre sou Okalab",
      note: "Si ou pa t mande lyen sa a, ou ka inyore imel sa a.",
      footer: "Imel sa a te voye otomatikman pa Okalab.",
    },
    reset_password: {
      subject: "Reyajiste modpas ou",
      eyebrow: "Sekirite",
      title: "Chwazi yon nouvo modpas",
      intro: "Nou resevwa yon demann pou chanje modpas kont ou. Svi ak bouton ki anba a pou kontinye.",
      cta: "Reyajiste modpas",
      note: "Si ou pa t mande chanjman sa a, inyore imel sa a epi modpas ou ap rete menm jan an.",
      footer: "Imel sa a te voye otomatikman pa Okalab.",
    },
  },
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const resolveLocale = (value?: string | null): SupportedLocale => {
  if (!value) return "es";
  const short = value.toLowerCase().slice(0, 2);
  if (short === "en" || short === "fr" || short === "ht") return short;
  return "es";
};

export function renderAuthEmail({
  type,
  locale,
  appName,
  logoUrl,
  actionUrl,
  supportUrl,
}: RenderAuthEmailParams) {
  const lang = resolveLocale(locale);
  const copy = TEMPLATE_COPY[lang][type];
  const safeAppName = escapeHtml(appName || DEFAULT_APP_NAME);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeSupportUrl = supportUrl ? escapeHtml(supportUrl) : null;
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : null;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#eef2ff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#0f172a;border:1px solid #1e293b;border-radius:28px;">
                  <tr>
                    <td style="padding:24px 28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding-right:12px;vertical-align:middle;">
                            ${
                              safeLogoUrl
                                ? `<img src="${safeLogoUrl}" alt="${safeAppName}" style="height:40px;width:40px;border-radius:12px;display:block;" />`
                                : `<div style="height:40px;width:40px;border-radius:14px;background:#2563eb;color:#ffffff;font-weight:700;font-size:22px;line-height:40px;text-align:center;">O</div>`
                            }
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="color:#ffffff;font-size:22px;font-weight:700;line-height:1.2;">${safeAppName}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe4ff;border-radius:28px;box-shadow:0 24px 60px rgba(15,23,42,0.12);">
                  <tr>
                    <td style="padding:36px 32px;">
                      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                        ${escapeHtml(copy.eyebrow)}
                      </div>
                      <div style="height:18px;line-height:18px;">&nbsp;</div>
                      <div style="font-size:32px;line-height:1.15;font-weight:700;color:#0f172a;">
                        ${escapeHtml(copy.title)}
                      </div>
                      <div style="height:12px;line-height:12px;">&nbsp;</div>
                      <div style="font-size:16px;line-height:1.7;color:#475569;">
                        ${escapeHtml(copy.intro)}
                      </div>
                      <div style="height:24px;line-height:24px;">&nbsp;</div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="border-radius:14px;background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);">
                            <a
                              href="${safeActionUrl}"
                              style="display:inline-block;padding:14px 22px;border-radius:14px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;"
                            >
                              ${escapeHtml(copy.cta)}
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="height:24px;line-height:24px;">&nbsp;</div>
                      <div style="font-size:14px;line-height:1.7;color:#64748b;">
                        ${escapeHtml(copy.note)}
                      </div>
                      <div style="height:28px;line-height:28px;">&nbsp;</div>
                      <div style="border-top:1px solid #e2e8f0;height:1px;line-height:1px;">&nbsp;</div>
                      <div style="height:20px;line-height:20px;">&nbsp;</div>
                      <div style="font-size:13px;line-height:1.6;color:#94a3b8;">
                        ${escapeHtml(copy.footer)}
                      </div>
                      ${
                        safeSupportUrl
                          ? `<div style="height:10px;line-height:10px;">&nbsp;</div><div style="font-size:13px;line-height:1.6;"><a href="${safeSupportUrl}" style="color:#2563eb;text-decoration:none;">${safeSupportUrl}</a></div>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    copy.subject,
    copy.title,
    copy.intro,
    `${copy.cta}: ${actionUrl}`,
    copy.note,
    copy.footer,
    supportUrl || "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject: copy.subject,
    html,
    text,
  };
}
