// GET/POST /api/recovery — чек-ин самочувствия клиента

import { handle, requireUser, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const clientId = user.role === "client" ? user.id : +url.searchParams.get("client_id");
  if (!clientId) return error(400, "client_id required");
  if (user.role === "trainer") {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2").bind(clientId, user.id).first();
    if (!ok) return error(403, "forbidden");
  }
  const limit = Math.min(60, +url.searchParams.get("limit") || 14);
  const { results } = await env.DB.prepare(
    "SELECT log_date, sleep_hours, energy, soreness, mood, note FROM recovery_logs WHERE client_id=?1 ORDER BY log_date DESC LIMIT ?2"
  ).bind(clientId, limit).all();
  return json({ logs: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const body = await readJson(request);
  const d = body.log_date || new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO recovery_logs (client_id, log_date, sleep_hours, energy, soreness, mood, note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(user.id, d, body.sleep_hours ?? null, body.energy ?? null, body.soreness ?? null, body.mood ?? null, body.note || null).run();
  return json({ ok: true });
});
