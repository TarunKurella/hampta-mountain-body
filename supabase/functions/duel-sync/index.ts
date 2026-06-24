import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DUEL_CODE = "HAMPTA20";
const PLAYERS = new Set(["tarun", "sudhanshu"]);

type SyncEvent = {
  playerId: string;
  duelCode: string;
  data?: {
    days?: Record<string, unknown>;
    gear?: Record<string, boolean>;
  };
  updatedAt?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase secrets" }, 500);

  let body: { duelCode?: string; events?: SyncEvent[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.duelCode !== DUEL_CODE) return json({ error: "Invalid duel" }, 403);
  const events = Array.isArray(body.events) ? body.events.slice(-30) : [];

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const event of events) {
    if (event.duelCode !== DUEL_CODE || !PLAYERS.has(event.playerId)) continue;
    const days = event.data?.days || {};
    const gear = event.data?.gear || {};

    const dayRows = Object.entries(days).map(([date, payload]) => {
      const day = payload as { complete?: boolean; started?: boolean; score?: number };
      return {
        duel_code: DUEL_CODE,
        player_id: event.playerId,
        log_date: date,
        payload,
        score: Number.isFinite(day.score) ? Number(day.score) : 0,
        status: day.complete ? "cleared" : day.started ? "started" : "pending",
        updated_at: event.updatedAt || new Date().toISOString(),
      };
    });

    if (dayRows.length) {
      const { error } = await supabase
        .from("daily_logs")
        .upsert(dayRows, { onConflict: "duel_code,player_id,log_date" });
      if (error) return json({ error: error.message }, 500);
    }

    const gearRows = Object.entries(gear).map(([itemId, done]) => ({
      duel_code: DUEL_CODE,
      player_id: event.playerId,
      item_id: itemId,
      done: Boolean(done),
      updated_at: event.updatedAt || new Date().toISOString(),
    }));

    if (gearRows.length) {
      const { error } = await supabase
        .from("gear_logs")
        .upsert(gearRows, { onConflict: "duel_code,player_id,item_id" });
      if (error) return json({ error: error.message }, 500);
    }
  }

  const snapshot = await buildSnapshot(supabase);
  return json({ snapshot });
});

async function buildSnapshot(supabase: ReturnType<typeof createClient>) {
  const { data: profiles, error: profileError } = await supabase.from("duel_profiles").select("*");
  if (profileError) throw profileError;

  const { data: dailyLogs, error: dailyError } = await supabase
    .from("daily_logs")
    .select("player_id, log_date, payload, updated_at")
    .eq("duel_code", DUEL_CODE);
  if (dailyError) throw dailyError;

  const { data: gearLogs, error: gearError } = await supabase
    .from("gear_logs")
    .select("player_id, item_id, done, updated_at")
    .eq("duel_code", DUEL_CODE);
  if (gearError) throw gearError;

  const snapshot = { version: 1, duelCode: DUEL_CODE, updatedAt: new Date().toISOString(), players: {} as Record<string, unknown> };
  for (const playerId of PLAYERS) {
    const profile = profiles?.find((profile) => profile.player_id === playerId);
    const days: Record<string, unknown> = {};
    const gear: Record<string, boolean> = {};
    for (const row of dailyLogs || []) {
      if (row.player_id === playerId) days[row.log_date] = row.payload;
    }
    for (const row of gearLogs || []) {
      if (row.player_id === playerId) gear[row.item_id] = row.done;
    }
    snapshot.players[playerId] = {
      profile: profile ? {
        id: profile.player_id,
        name: profile.display_name,
        role: profile.role_title,
        avatarId: profile.avatar_id,
      } : null,
      days,
      gear,
    };
  }
  return snapshot;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
