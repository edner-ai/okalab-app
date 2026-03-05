import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("MAIL_FROM")!;
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/$/, "");

const buildLink = (link?: string | null) => {
  if (!link) return null;
  if (link.startsWith("http")) return link;
  if (!PUBLIC_SITE_URL) return link;
  return `${PUBLIC_SITE_URL}${link.startsWith("/") ? "" : "/"}${link}`;
};

serve(async () => {
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("app_name, app_logo_url")
    .eq("id", 1)
    .maybeSingle();

  const appName = settings?.app_name || "Okalab";
  const logoUrl = settings?.app_logo_url || null;

  const { data: rows, error } = await supabase
    .from("email_outbox")
    .select("id,email,subject,body,link")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return new Response(error.message, { status: 500 });
  if (!rows || rows.length === 0) return new Response("No pending emails");

  for (const row of rows) {
    try {
      const finalLink = buildLink(row.link);

      const html = `
        <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="height:40px;margin-bottom:16px;" />` : `<h2 style="margin:0 0 16px 0;">${appName}</h2>`}
            <h3 style="margin:0 0 8px 0;color:#0f172a;">${row.subject}</h3>
            <p style="margin:0 0 16px 0;color:#475569;">${row.body ?? ""}</p>
            ${finalLink ? `<a href="${finalLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Ver notificacion</a>` : ""}
            <p style="margin-top:20px;color:#94a3b8;font-size:12px;">${appName} · Notificacion automatica</p>
          </div>
        </div>
      `;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: row.email,
          subject: row.subject,
          html,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }

      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
    } catch (err: any) {
      await supabase
        .from("email_outbox")
        .update({ status: "error", error: String(err?.message || err) })
        .eq("id", row.id);
    }
  }

  return new Response("ok");
});
