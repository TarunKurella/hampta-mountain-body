import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DUEL_CODE = "HAMPTA20";
const PLAYERS = new Set(["tarun", "sudhanshu"]);
const EVENT_KINDS = new Set(["task", "stage", "gear"]);

type PlayerId = "tarun" | "sudhanshu";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:tarun@example.com";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Missing duel event secrets" }, 500);
  }

  let body: { duelCode?: string; playerId?: PlayerId; kind?: string; label?: string; date?: string; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.duelCode !== DUEL_CODE) return json({ error: "Invalid duel" }, 403);
  if (!body.playerId || !PLAYERS.has(body.playerId)) return json({ error: "Invalid player" }, 403);
  if (!body.kind || !EVENT_KINDS.has(body.kind)) return json({ error: "Invalid event" }, 400);

  const actor = body.playerId;
  const opponent = actor === "tarun" ? "sudhanshu" : "tarun";
  const label = cleanLabel(body.label || "progress");
  const payload = buildPayload(actor, body.kind, label, body.date);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: prefs, error: preferenceError } = await supabase
    .from("notification_preferences")
    .select("friend_cleared_enabled, rivalry_enabled")
    .eq("duel_code", DUEL_CODE)
    .eq("player_id", opponent)
    .maybeSingle();
  if (preferenceError) return json({ error: preferenceError.message }, 500);
  if (prefs?.friend_cleared_enabled === false || prefs?.rivalry_enabled === false) {
    return json({ ok: true, skipped: "opponent_preferences_off" });
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("duel_code", DUEL_CODE)
    .eq("player_id", opponent)
    .eq("enabled", true);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const targets = dedupeSubscriptions(subscriptions || []);
  if (body.dryRun) return json({ ok: true, dryRun: true, actor, opponent, targetCount: targets.length, payload });

  let sent = 0;
  let disabled = 0;
  const failures: string[] = [];

  for (const row of targets) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 3600 });
      sent += 1;
    } catch (err) {
      const statusCode = Number((err as { statusCode?: number }).statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        disabled += 1;
        await supabase.from("push_subscriptions").update({
          enabled: false,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
      } else {
        failures.push(String(statusCode || "send_failed"));
      }
    }
  }

  return json({ ok: true, actor, opponent, sent, disabled, failures });
});

function buildPayload(actor: PlayerId, kind: string, label: string, date?: string) {
  const actorName = actor === "tarun" ? "Tarun" : "Sudhanshu";
  const noun = kind === "stage" ? "cleared" : kind === "gear" ? "locked gear" : "logged";
  return {
    title: `${actorName} ${noun}`,
    body: `${actorName} did ${label}. Your move: open the duel and close one clean action.`,
    tag: `hampta-duel-${date || "today"}-${actor}-${kind}-${slug(label)}`,
    url: "./index.html?tab=duel",
  };
}

function cleanLabel(value: string) {
  return value.replace(/[^\w\s./-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "progress";
}

function slug(value: string) {
  return cleanLabel(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function dedupeSubscriptions(rows: Array<{ id: string; subscription: Record<string, unknown> }>) {
  const seen = new Set<string>();
  const result: Array<{ id: string; subscription: Record<string, unknown> }> = [];
  for (const row of rows) {
    const endpoint = typeof row.subscription?.endpoint === "string" ? row.subscription.endpoint : row.id;
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    result.push(row);
  }
  return result;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
