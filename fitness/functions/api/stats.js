// GET /api/stats?days=90 — для клиента: streak, heatmap, total sessions, PR count.

import { handle, requireUser, json } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const days = Math.min(365, +url.searchParams.get("days") || 90);
  const clientId = user.role === "client" ? user.id : +url.searchParams.get("client_id");
  if (!clientId) return json({ streak: 0, heatmap: [], total_sessions: 0, prs: 0 });
  if (user.role === "trainer") {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2").bind(clientId, user.id).first();
    if (!ok) return json({ streak: 0, heatmap: [], total_sessions: 0, prs: 0 });
  }

  // heatmap: дата + count
  const { results: hm } = await env.DB.prepare(
    `SELECT log_date AS d, COUNT(*) AS c
       FROM workout_logs
      WHERE client_id=?1 AND log_date >= date('now', ?2)
      GROUP BY log_date
      ORDER BY log_date`
  ).bind(clientId, `-${days} days`).all();
  const heatmap = hm || [];

  // total
  const total = await env.DB.prepare(
    "SELECT COUNT(DISTINCT log_date) AS d FROM workout_logs WHERE client_id=?1"
  ).bind(clientId).first();

  // streak = подряд идущих дней, считая от сегодня назад. Дни отдыха считаются как продолжение, не разрыв.
  const days_set = new Set(heatmap.map((r) => r.d));
  const { results: restRes } = await env.DB.prepare(
    "SELECT log_date FROM rest_days WHERE client_id=?1"
  ).bind(clientId).all();
  const rest_set = new Set((restRes || []).map((r) => r.log_date));

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 400; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (i === 0 && !days_set.has(ds) && !rest_set.has(ds)) {
      // сегодня ещё не тренировался — не разрываем streak, просто пропускаем
      continue;
    }
    if (days_set.has(ds) || rest_set.has(ds)) {
      streak += days_set.has(ds) ? 1 : 0; // считаем только тренировки
    } else {
      break;
    }
  }

  // Personal records — простой подсчёт: сколько раз клиент ставил новый максимум done_weight в каждом упражнении.
  const prs = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT exercise_id, MAX(done_weight) AS m FROM workout_logs WHERE client_id=?1 AND done_weight IS NOT NULL GROUP BY exercise_id
     )`
  ).bind(clientId).first();

  return json({ streak, heatmap, total_sessions: total?.d || 0, prs: prs?.n || 0 });
});
