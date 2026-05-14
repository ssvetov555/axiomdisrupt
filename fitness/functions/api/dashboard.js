// GET /api/dashboard — сводка для тренера на главной.

import { handle, requireTrainer, json } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);

  const clients = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE role='client' AND trainer_id=?1"
  ).bind(trainer.id).first();

  const activeAsg = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM assignments a
       JOIN programs p ON p.id=a.program_id
      WHERE p.trainer_id=?1 AND a.is_active=1`
  ).bind(trainer.id).first();

  const week = await env.DB.prepare(
    `SELECT COUNT(*) AS sessions, COUNT(DISTINCT w.client_id) AS active_clients
       FROM workout_logs w
       JOIN users u ON u.id=w.client_id
      WHERE u.trainer_id=?1 AND w.log_date >= date('now','-7 days')`
  ).bind(trainer.id).first();

  // клиенты, кто не тренировался 5+ дней
  const stale = await env.DB.prepare(
    `SELECT u.id, u.name,
            (SELECT MAX(log_date) FROM workout_logs w WHERE w.client_id=u.id) AS last_log
       FROM users u
      WHERE u.role='client' AND u.trainer_id=?1
        AND (
          (SELECT MAX(log_date) FROM workout_logs w WHERE w.client_id=u.id) IS NULL
          OR (SELECT MAX(log_date) FROM workout_logs w WHERE w.client_id=u.id) <= date('now','-5 days')
        )
      ORDER BY last_log NULLS LAST
      LIMIT 5`
  ).bind(trainer.id).all();

  return json({
    clients_count: clients?.n || 0,
    active_assignments: activeAsg?.n || 0,
    week_sessions: week?.sessions || 0,
    week_active_clients: week?.active_clients || 0,
    stale_clients: stale.results || [],
  });
});
