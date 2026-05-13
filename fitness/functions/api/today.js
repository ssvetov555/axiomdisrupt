// GET /api/today  — упражнения клиента на сегодня (по активным назначениям и дню недели).
// Используется в кабинете клиента как "Программа на сегодня".

import { handle, requireUser, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date"); // YYYY-MM-DD

  // вычисляем день недели 1..7 (Пн..Вс)
  const d = dateParam ? new Date(dateParam + "T00:00:00Z") : new Date();
  // getUTCDay: 0=Sun..6=Sat. Приведём к 1..7 где 1=Mon.
  const dow = ((d.getUTCDay() + 6) % 7) + 1;
  const today = (dateParam || d.toISOString().slice(0, 10));

  const { results } = await env.DB.prepare(
    `SELECT e.id AS exercise_id, e.name, e.description, e.video_url,
            e.target_sets, e.target_reps, e.target_weight, e.rest_seconds,
            e.day_of_week, e.order_index,
            a.id AS assignment_id, a.program_id, p.name AS program_name,
            (SELECT json_object(
                      'id', w.id,
                      'done_sets', w.done_sets,
                      'done_reps', w.done_reps,
                      'done_weight', w.done_weight,
                      'client_note', w.client_note,
                      'completed', w.completed,
                      'created_at', w.created_at)
               FROM workout_logs w
              WHERE w.exercise_id = e.id AND w.client_id = a.client_id AND w.log_date = ?2
              ORDER BY w.created_at DESC LIMIT 1) AS today_log
       FROM assignments a
       JOIN programs p ON p.id = a.program_id
       JOIN exercises e ON e.program_id = p.id
      WHERE a.client_id = ?1 AND a.is_active = 1
        AND (e.day_of_week = ?3 OR e.day_of_week IS NULL)
      ORDER BY p.name, e.order_index, e.id`
  )
    .bind(user.id, today, dow)
    .all();

  return json({ date: today, day_of_week: dow, items: results });
});
