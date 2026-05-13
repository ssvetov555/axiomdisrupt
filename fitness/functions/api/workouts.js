// GET /api/workouts — журнал.
//   тренер: ?client_id=...&from=&to=  (опционально)
//   клиент: только свои записи
// POST /api/workouts (только клиент) — записать выполнение упражнения.
//   { exercise_id, assignment_id, done_sets, done_reps, done_weight, client_note, log_date?, completed? }

import { handle, requireUser, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const exerciseId = url.searchParams.get("exercise_id");

  let where = [];
  let binds = [];
  if (user.role === "trainer") {
    const clientId = url.searchParams.get("client_id");
    if (!clientId) return error(400, "client_id required for trainer");
    // убедимся, что клиент принадлежит тренеру
    const ok = await env.DB.prepare(
      "SELECT 1 FROM users WHERE id = ?1 AND trainer_id = ?2 AND role='client'"
    )
      .bind(clientId, user.id)
      .first();
    if (!ok) return error(404, "client not found");
    where.push("w.client_id = ?");
    binds.push(clientId);
  } else {
    where.push("w.client_id = ?");
    binds.push(user.id);
  }
  if (from) {
    where.push("w.log_date >= ?");
    binds.push(from);
  }
  if (to) {
    where.push("w.log_date <= ?");
    binds.push(to);
  }
  if (exerciseId) {
    where.push("w.exercise_id = ?");
    binds.push(exerciseId);
  }
  const sql = `
    SELECT w.id, w.assignment_id, w.client_id, w.exercise_id, w.log_date,
           w.done_sets, w.done_reps, w.done_weight, w.client_note, w.completed, w.created_at,
           e.name AS exercise_name, e.target_sets, e.target_reps, e.target_weight
      FROM workout_logs w
      JOIN exercises e ON e.id = w.exercise_id
     WHERE ${where.join(" AND ")}
     ORDER BY w.log_date DESC, w.created_at DESC`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ logs: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client can log");
  const body = await readJson(request);
  const { exercise_id, assignment_id, done_sets, done_reps, done_weight, client_note, log_date, completed } = body;
  if (!exercise_id || !assignment_id) return error(400, "exercise_id and assignment_id required");
  // assignment должен принадлежать клиенту
  const asg = await env.DB.prepare(
    "SELECT id FROM assignments WHERE id = ?1 AND client_id = ?2"
  )
    .bind(assignment_id, user.id)
    .first();
  if (!asg) return error(404, "assignment not found");
  const res = await env.DB.prepare(
    `INSERT INTO workout_logs (assignment_id, client_id, exercise_id, log_date, done_sets, done_reps, done_weight, client_note, completed)
     VALUES (?1, ?2, ?3, COALESCE(?4, date('now')), ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(
      assignment_id,
      user.id,
      exercise_id,
      log_date || null,
      done_sets || null,
      done_reps || null,
      done_weight || null,
      client_note || null,
      completed === false ? 0 : 1
    )
    .run();
  return json({ ok: true, id: res.meta.last_row_id });
});
