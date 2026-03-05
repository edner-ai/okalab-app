import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:standardwebhooks";
import {
  renderAuthEmail,
  SUPABASE_AUTH_EMAIL_TYPE_MAP,
  type AuthEmailTemplateType,
} from "../_shared/authEmailTemplates.ts";

type SendEmailHookPayload = {
  user?: {
    id?: string | null;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
  email_data?: {
    token_hash?: string | null;
    redirect_to?: string | null;
    site_url?: string | null;
    email_action_type?: string | null;
  } | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
const fromEmail = Deno.env.get("MAIL_FROM")!;
const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/$/, "");
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "").replace(/^v1,whsec_/, "");

const supabase = createClient(supabaseUrl, serviceRoleKey);

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getHeaderMap = (req: Request) => ({
  "webhook-id": req.headers.get("webhook-id") ?? "",
  "webhook-signature": req.headers.get("webhook-signature") ?? "",
  "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
});

const getMetadataLocale = (payload: SendEmailHookPayload) => {
  const preferred =
    payload.user?.user_metadata?.preferred_language ??
    payload.user?.user_metadata?.locale ??
    payload.user?.user_metadata?.lang;
  return typeof preferred === "string" ? preferred : null;
};

const resolveTemplateType = (emailActionType?: string | null): AuthEmailTemplateType | null => {
  if (!emailActionType) return null;
  return SUPABASE_AUTH_EMAIL_TYPE_MAP[emailActionType] ?? null;
};

const resolveVerifyType = (emailActionType?: string | null) => {
  if (!emailActionType) return null;
  if (["signup", "invite", "magiclink", "recovery"].includes(emailActionType)) {
    return emailActionType;
  }
  return null;
};

const buildAuthConfirmUrl = ({
  tokenHash,
  verifyType,
  redirectTo,
  siteUrl,
}: {
  tokenHash: string;
  verifyType: string;
  redirectTo?: string | null;
  siteUrl?: string | null;
}) => {
  const baseUrl = (publicSiteUrl || siteUrl || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Missing PUBLIC_SITE_URL or site_url for auth email hook");
  }

  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: verifyType,
  });

  if (redirectTo) {
    params.set("redirect_to", redirectTo);
  }

  return `${baseUrl}/auth/confirm?${params.toString()}`;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const rawBody = await req.text();
    const webhook = new Webhook(hookSecret);
    const payload = webhook.verify(rawBody, getHeaderMap(req)) as SendEmailHookPayload;

    const recipientEmail = payload.user?.email;
    const userId = payload.user?.id;
    const emailActionType = payload.email_data?.email_action_type;
    const tokenHash = payload.email_data?.token_hash;
    const redirectTo = payload.email_data?.redirect_to;
    const siteUrl = payload.email_data?.site_url;

    if (!recipientEmail) {
      return jsonResponse({ error: "Missing recipient email" }, 400);
    }

    const templateType = resolveTemplateType(emailActionType);
    const verifyType = resolveVerifyType(emailActionType);

    if (!templateType || !verifyType || !tokenHash) {
      return jsonResponse({ ok: true, ignored: true, email_action_type: emailActionType ?? null });
    }

    const actionUrl = buildAuthConfirmUrl({
      tokenHash,
      verifyType,
      redirectTo,
      siteUrl,
    });

    const metadataLocale = getMetadataLocale(payload);

    let locale = metadataLocale;
    if (!locale && (userId || recipientEmail)) {
      let profileQuery = supabase.from("profiles").select("preferred_language").limit(1);
      if (userId) {
        profileQuery = profileQuery.eq("id", userId);
      } else if (recipientEmail) {
        profileQuery = profileQuery.eq("email", recipientEmail);
      }
      const { data: profile } = await profileQuery.maybeSingle();
      locale = profile?.preferred_language || null;
    }

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("app_name, app_logo_url, support_email")
      .eq("id", 1)
      .maybeSingle();

    const appName = settings?.app_name || "Okalab";
    const logoUrl = settings?.app_logo_url || null;
    const supportUrl = settings?.support_email
      ? `mailto:${settings.support_email}`
      : publicSiteUrl
        ? `${publicSiteUrl}/support`
        : null;

    const rendered = renderAuthEmail({
      type: templateType,
      locale,
      appName,
      logoUrl,
      actionUrl,
      supportUrl,
    });

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });

    if (!resendResp.ok) {
      const message = await resendResp.text();
      throw new Error(message);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});
