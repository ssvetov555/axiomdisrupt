// GET/POST/DELETE /api/bodylogs — замеры тела клиента.

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
  const { results } = await env.DB.prepare(
    `SELECT id, log_date, weight_kg, waist_cm, chest_cm, arm_cm, note, created_at
       FROM body_logs WHERE client_id=?1 ORDER BY log_date ASC`
  ).bind(clientId).all();
  return json({ logs: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const body = await readJson(request);
  const { log_date, weight_kg, waist_cm, chest_cm, arm_cm, note } = body;
  if (weight_kg == null && waist_cm == null && chest_cm == null && arm_cm == null) {
    return error(400, "at least one measurement required");
  }
  const res = await env.DB.prepare(
    `INSERT INTO body_logs (client_id, log_date, weight_kg, waist_cm, chest_cm, arm_cm, note)
     VALUES (?1, COALESCE(?2, date('now')), ?3, ?4, ?5, ?6, ?7)`
  ).bind(user.id, log_date || null, weight_kg ?? null, waist_cm ?? null, chest_cm ?? null, arm_cm ?? null, note || null).run();
  return json({ ok: true, id: res.meta.last_row_id });
});
