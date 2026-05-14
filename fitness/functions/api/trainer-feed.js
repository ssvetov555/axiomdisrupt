// GET /api/trainer-feed — последние 50 комментариев + последние тренировки клиентов.
// Для inbox-стиля у тренера.

import { handle, requireTrainer, json } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { results: comments } = await env.DB.prepare(
    `SELECT c.id, c.body, c.created_at, c.exercise_id, c.client_id,
            u_a.name AS author_name, u_a.role AS author_role,
            u_c.name AS client_name,
            e.name AS exercise_name
       FROM comments c
       JOIN users u_a ON u_a.id = c.author_id
       JOIN users u_c ON u_c.id = c.client_id
       JOIN exercises e ON e.id = c.exercise_id
       JOIN programs p ON p.id = e.program_id
      WHERE p.trainer_id = ?1
      ORDER BY c.created_at DESC LIMIT 50`
  ).bind(trainer.id).all();

  const { results: workouts } = await env.DB.prepare(
    `SELECT w.id, w.log_date, w.done_sets, w.done_reps, w.done_weight, w.created_at,
            w.client_note,
            u.name AS client_name, e.name AS exercise_name
       FROM workout_logs w
       JOIN users u ON u.id = w.client_id
       JOIN exercises e ON e.id = w.exercise_id
       JOIN programs p ON p.id = e.program_id
      WHERE p.trainer_id = ?1
      ORDER BY w.created_at DESC LIMIT 30`
  ).bind(trainer.id).all();

  return json({ comments, workouts });
});
