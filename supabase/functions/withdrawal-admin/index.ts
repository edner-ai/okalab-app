import { serve } from "https://deno.land/std@0.202.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-user-token, authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[withdrawal-admin:${requestId}] ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      console.log(`[withdrawal-admin:${requestId}] Missing env vars`, {
        hasUrl: Boolean(supabaseUrl),
        hasAnon: Boolean(anonKey),
      });
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const rawAuth = req.headers.get("Authorization") ?? "";
    const userToken = req.headers.get("x-user-token") ?? "";
    const effectiveToken =
      userToken ||
      (rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth.slice(7) : rawAuth);
    console.log(`[withdrawal-admin:${requestId}] user token present: ${Boolean(effectiveToken)}`);
    if (!effectiveToken) {
      return jsonResponse({ error: "Missing user token" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${effectiveToken}` } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      console.log(`[withdrawal-admin:${requestId}] auth error`, authError?.message || authError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    console.log(`[withdrawal-admin:${requestId}] user`, authData.user.id);

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) {
      console.log(`[withdrawal-admin:${requestId}] profile error`, profileError.message);
      return jsonResponse({ error: profileError.message }, 400);
    }

    const role = (profile?.role || "").toLowerCase();
    if (role !== "admin") {
      console.log(`[withdrawal-admin:${requestId}] forbidden role`, role);
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch((err) => {
      console.log(`[withdrawal-admin:${requestId}] invalid JSON`, err?.message || err);
      return {};
    });
    const action = (body?.action || "").toLowerCase();
    const withdrawalId = body?.withdrawal_id || body?.id;
    const reason = body?.reason;

    if (!withdrawalId || !action) {
      console.log(`[withdrawal-admin:${requestId}] missing params`, { action, withdrawalId });
      return jsonResponse({ error: "Missing action or withdrawal_id" }, 400);
    }

    if (action === "approve") {
      const { error } = await userClient.rpc("approve_withdrawal", {
        p_withdrawal_id: withdrawalId,
      });
      if (error) {
        console.log(`[withdrawal-admin:${requestId}] approve error`, error.message);
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ ok: true });
    }

    if (action === "reject") {
      const { error } = await userClient.rpc("reject_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_reason: reason || "Rejected by admin",
      });
      if (error) {
        console.log(`[withdrawal-admin:${requestId}] reject error`, error.message);
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    console.log(`[withdrawal-admin:${requestId}] unexpected error`, err?.message || err);
    return jsonResponse({ error: err?.message || "Unexpected error" }, 500);
  }
});
