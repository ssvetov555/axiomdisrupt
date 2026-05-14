// /api/goals
// GET (клиент: свои, тренер: ?client_id=...)
// POST { kind, title, target_value, start_value, unit, target_date, exercise_id?, note? }

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
    `SELECT g.id, g.kind, g.title, g.target_value, g.start_value, g.unit,
            g.target_date, g.achieved_at, g.note, g.exercise_id, g.created_at,
            e.name AS exercise_name,
            (SELECT MAX(done_weight) FROM workout_logs w
              WHERE w.client_id = g.client_id AND w.exercise_id = g.exercise_id) AS current_max_weight,
            (SELECT weight_kg FROM body_logs b WHERE b.client_id = g.client_id ORDER BY log_date DESC LIMIT 1) AS current_body_weight
       FROM goals g
       LEFT JOIN exercises e ON e.id = g.exercise_id
      WHERE g.client_id = ?1
      ORDER BY g.achieved_at IS NULL DESC, g.target_date NULLS LAST, g.created_at DESC`
  ).bind(clientId).all();
  return json({ goals: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const clientId = user.role === "client" ? user.id : +body.client_id;
  if (!clientId) return error(400, "client_id required");
  if (user.role === "trainer") {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2").bind(clientId, user.id).first();
    if (!ok) return error(403, "forbidden");
  }
  const { kind, title, target_value, start_value, unit, target_date, exercise_id, note } = body;
  if (!kind || !title) return error(400, "kind and title required");
  const res = await env.DB.prepare(
    `INSERT INTO goals (client_id, kind, exercise_id, title, target_value, start_value, unit, target_date, note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(clientId, kind, exercise_id || null, title, target_value ?? null, start_value ?? null, unit || null, target_date || null, note || null).run();
  return json({ ok: true, id: res.meta.last_row_id });
});
