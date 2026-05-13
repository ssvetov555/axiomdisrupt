// GET /api/clients/[id]/summary
// Сводка прогресса клиента для тренера: дни недели, последние тренировки, активные программы.

import { handle, requireTrainer, json, error } from "../../../_lib.js";

export const onRequestGet = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const clientId = +params.id;
  const ok = await env.DB.prepare(
    "SELECT id, name, notes, created_at FROM users WHERE id = ?1 AND trainer_id = ?2 AND role='client'"
  )
    .bind(clientId, trainer.id)
    .first();
  if (!ok) return error(404, "not found");

  const { results: assignments } = await env.DB.prepare(
    `SELECT a.id, a.program_id, a.is_active, a.start_date, a.end_date, p.name
       FROM assignments a JOIN programs p ON p.id = a.program_id
      WHERE a.client_id = ?1 ORDER BY a.is_active DESC, a.created_at DESC`
  )
    .bind(clientId)
    .all();

  const { results: recent } = await env.DB.prepare(
    `SELECT w.log_date, w.done_sets, w.done_reps, w.done_weight, w.client_note, w.completed,
            e.name AS exercise_name
       FROM workout_logs w JOIN exercises e ON e.id = w.exercise_id
      WHERE w.client_id = ?1
      ORDER BY w.created_at DESC LIMIT 20`
  )
    .bind(clientId)
    .all();

  // ежедневная статистика за 30 дней
  const { results: daily } = await env.DB.prepare(
    `SELECT log_date, COUNT(*) AS done_count
       FROM workout_logs
      WHERE client_id = ?1 AND log_date >= date('now', '-30 days')
      GROUP BY log_date ORDER BY log_date`
  )
    .bind(clientId)
    .all();

  return json({ client: ok, assignments, recent, daily });
});
