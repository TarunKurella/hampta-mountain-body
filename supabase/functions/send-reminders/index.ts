import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DUEL_CODE = "HAMPTA20";
const TREK_START = "2026-07-20";
const START_DATE = "2026-06-24";
const PROTEIN_AFTERNOON_MIN = 60;
const VALID_TYPES = new Set(["morning", "protein", "evening"]);

type ReminderType = "morning" | "protein" | "evening";

type PushRow = {
  id: string;
  player_id: "tarun" | "sudhanshu";
  subscription: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:tarun@example.com";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Missing reminder secrets" }, 500);
  }

  let body: { type?: ReminderType; duelCode?: string; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.duelCode && body.duelCode !== DUEL_CODE) return json({ error: "Invalid duel" }, 403);
  const type = body.type || "morning";
  if (!VALID_TYPES.has(type)) return json({ error: "Invalid reminder type" }, 400);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, player_id, subscription")
    .eq("duel_code", DUEL_CODE)
    .eq("enabled", true);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const { data: preferenceRows, error: preferenceError } = await supabase
    .from("notification_preferences")
    .select("player_id, morning_enabled, protein_enabled, evening_enabled")
    .eq("duel_code", DUEL_CODE);
  if (preferenceError) return json({ error: preferenceError.message }, 500);
  const preferences = Object.fromEntries((preferenceRows || []).map((row) => [row.player_id, row]));

  const summary = await buildSummary(supabase);
  const deduped = dedupeSubscriptions((subscriptions || []) as PushRow[]);
  const targetRows = deduped.filter((row) => {
    const prefs = preferences[row.player_id];
    if (type === "morning") return prefs?.morning_enabled !== false;
    if (type === "protein") return prefs?.protein_enabled !== false && summary.players[row.player_id].proteinToday < PROTEIN_AFTERNOON_MIN;
    return prefs?.evening_enabled !== false;
  });
  if (body.dryRun) {
    return json({
      ok: true,
      dryRun: true,
      type,
      targetCount: targetRows.length,
      samplePayloads: targetRows.slice(0, 2).map((row) => buildPayload(type, row.player_id, summary)),
    });
  }

  let sent = 0;
  let disabled = 0;
  const failures: string[] = [];

  for (const row of targetRows) {
    const payload = JSON.stringify(buildPayload(type, row.player_id, summary));
    try {
      await webpush.sendNotification(row.subscription, payload, { TTL: type === "morning" ? 21600 : type === "protein" ? 7200 : 14400 });
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
        failures.push(`${row.player_id}:${statusCode || "send_failed"}`);
      }
    }
  }

  return json({ ok: true, type, sent, disabled, failures });
});

async function buildSummary(supabase: ReturnType<typeof createClient>) {
  const today = indiaDate();
  const { data: logs, error } = await supabase
    .from("daily_logs")
    .select("player_id, log_date, status, score, payload")
    .eq("duel_code", DUEL_CODE)
    .gte("log_date", START_DATE)
    .lte("log_date", today);
  if (error) throw error;

  const players = {
    tarun: { cleared: 0, score: 0, todayDone: false, proteinToday: 0 },
    sudhanshu: { cleared: 0, score: 0, todayDone: false, proteinToday: 0 },
  };

  for (const row of logs || []) {
    const playerId = row.player_id as keyof typeof players;
    if (!players[playerId]) continue;
    if (row.status === "cleared") players[playerId].cleared += 1;
    players[playerId].score += Number(row.score || 0);
    if (row.log_date === today) {
      if (row.status === "cleared") players[playerId].todayDone = true;
      players[playerId].proteinToday = proteinTotal(row.payload);
    }
  }

  return {
    today,
    daysLeft: Math.max(0, dateDiffDays(today, TREK_START)),
    players,
  };
}

function buildPayload(type: ReminderType, playerId: "tarun" | "sudhanshu", summary: Awaited<ReturnType<typeof buildSummary>>) {
  const name = playerId === "tarun" ? "Tarun" : "Sudhanshu";
  const player = summary.players[playerId];
  const opponentId = playerId === "tarun" ? "sudhanshu" : "tarun";
  const opponent = summary.players[opponentId];

  if (type === "morning") {
    return {
      title: `${summary.daysLeft} days to Hampta`,
      body: `${name}, open the cockpit. One clean stage today. Gym body -> mountain body.`,
      tag: `hampta-morning-${summary.today}-${playerId}`,
      url: "./index.html?tab=today",
    };
  }

  if (type === "protein") {
    const grams = Math.round(player.proteinToday || 0);
    return {
      title: `Protein check: ${grams}/${PROTEIN_AFTERNOON_MIN}g by 3pm`,
      body: `${name}, add one simple protein hit now. Afternoon fuel keeps the 130g target realistic.`,
      tag: `hampta-protein-${summary.today}-${playerId}`,
      url: "./index.html?tab=protein",
    };
  }

  const lead = player.score - opponent.score;
  const leadText = lead === 0 ? "Duel level" : lead > 0 ? `You lead by ${lead}` : `You trail by ${Math.abs(lead)}`;
  return {
    title: player.todayDone ? "Stage logged. Close recovery." : "Night check: stage still open",
    body: `${name}: ${player.cleared} stages cleared. ${leadText}. Log sleep, pain, and hydration before 10:30.`,
    tag: `hampta-evening-${summary.today}-${playerId}`,
    url: "./index.html?tab=body",
  };
}

function proteinTotal(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;
  const day = payload as {
    proteinEntries?: Array<{ grams?: unknown }>;
    metrics?: { proteinGrams?: unknown };
  };
  if (Array.isArray(day.proteinEntries) && day.proteinEntries.length) {
    return day.proteinEntries.reduce((sum, entry) => sum + numberFrom(entry?.grams), 0);
  }
  return numberFrom(day.metrics?.proteinGrams);
}

function numberFrom(value: unknown) {
  const n = Number.parseFloat(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function dedupeSubscriptions(rows: PushRow[]) {
  const seen = new Set<string>();
  const result: PushRow[] = [];
  for (const row of rows) {
    const endpoint = typeof row.subscription?.endpoint === "string" ? row.subscription.endpoint : row.id;
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    result.push(row);
  }
  return result;
}

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateDiffDays(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.ceil((end - start) / 86400000);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
