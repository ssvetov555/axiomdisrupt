// GET /api/progress?exercise_id=...&client_id=...
// История по конкретному упражнению — для графика.
// Клиент видит свои. Тренер должен передать client_id своего клиента.

import { handle, requireUser, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const exerciseId = url.searchParams.get("exercise_id");
  if (!exerciseId) return error(400, "exercise_id required");

  let clientId;
  if (user.role === "client") {
    clientId = user.id;
  } else {
    clientId = +url.searchParams.get("client_id");
    if (!clientId) return error(400, "client_id required for trainer");
    const ok = await env.DB.prepare(
      "SELECT 1 FROM users WHERE id = ?1 AND trainer_id = ?2"
    )
      .bind(clientId, user.id)
      .first();
    if (!ok) return error(404, "client not found");
  }

  const { results } = await env.DB.prepare(
    `SELECT log_date, done_sets, done_reps, done_weight, client_note, completed, created_at
       FROM workout_logs
      WHERE exercise_id = ?1 AND client_id = ?2
      ORDER BY log_date ASC, created_at ASC`
  )
    .bind(exerciseId, clientId)
    .all();
  return json({ history: results });
});
