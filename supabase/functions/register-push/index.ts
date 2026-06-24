import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DUEL_CODE = "HAMPTA20";
const PLAYERS = new Set(["tarun", "sudhanshu"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase secrets" }, 500);

  let body: {
    duelCode?: string;
    playerId?: string;
    subscription?: unknown;
    preferences?: Record<string, boolean>;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.duelCode !== DUEL_CODE) return json({ error: "Invalid duel" }, 403);
  if (!body.playerId || !PLAYERS.has(body.playerId)) return json({ error: "Invalid player" }, 403);
  if (!body.subscription || typeof body.subscription !== "object") return json({ error: "Missing subscription" }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: subscriptionError } = await supabase.from("push_subscriptions").insert({
    duel_code: DUEL_CODE,
    player_id: body.playerId,
    subscription: body.subscription,
    enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const prefs = body.preferences || {};
  const { error: preferenceError } = await supabase.from("notification_preferences").upsert({
    duel_code: DUEL_CODE,
    player_id: body.playerId,
    morning_enabled: prefs.morning ?? true,
    evening_enabled: prefs.evening ?? true,
    friend_cleared_enabled: prefs.friendCleared ?? true,
    rivalry_enabled: prefs.rivalry ?? true,
    safety_enabled: prefs.safety ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "duel_code,player_id" });
  if (preferenceError) return json({ error: preferenceError.message }, 500);

  return json({ ok: true });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
