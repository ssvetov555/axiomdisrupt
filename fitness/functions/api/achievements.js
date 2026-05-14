// GET /api/achievements?client_id=...
// Возвращает список разблокированных бейджей и кандидатов на следующую разблокировку.
// При каждом вызове пересчитывает и доначисляет новые бейджи.

import { handle, requireUser, json, error } from "../_lib.js";

const BADGES = [
  { code: "first_workout",  title: "Первая тренировка", desc: "Записал первое упражнение", emoji: "🥇" },
  { code: "streak_3",       title: "3 дня подряд",      desc: "Не пропустил трое суток",   emoji: "🔥" },
  { code: "streak_7",       title: "Неделя без пропусков", desc: "7 дней с тренировками",  emoji: "🔥🔥" },
  { code: "streak_30",      title: "Месяц-марафон",     desc: "30 дней подряд",            emoji: "🏆" },
  { code: "sessions_10",    title: "Десятка",           desc: "10 тренировок",             emoji: "💪" },
  { code: "sessions_50",    title: "Полтинник",         desc: "50 тренировок",             emoji: "💪💪" },
  { code: "sessions_100",   title: "Сотня",             desc: "100 тренировок",            emoji: "💯" },
  { code: "first_pr",       title: "Личный рекорд",     desc: "Поставил первый PR",        emoji: "⭐" },
  { code: "first_goal",     title: "Цель достигнута",   desc: "Закрыл первую цель",        emoji: "🎯" },
  { code: "volume_1000",    title: "Тонна",             desc: "Поднял 1 000 кг суммарно",  emoji: "🏋️" },
  { code: "volume_10000",   title: "Десять тонн",       desc: "10 000 кг суммарно",        emoji: "🏋️‍♂️" },
];

async function computeAwards(env, clientId) {
  const out = [];
  // Sessions
  const sessions = (await env.DB.prepare(
    "SELECT COUNT(DISTINCT log_date) AS d FROM workout_logs WHERE client_id=?1"
  ).bind(clientId).first())?.d || 0;

  // Volume
  const vol = (await env.DB.prepare(
    `SELECT COALESCE(SUM(done_sets * COALESCE(done_weight, 0) * COALESCE(CAST(SUBSTR(done_reps, 1, INSTR(done_reps||'x','x')-1) AS INTEGER), 0)), 0) AS v
       FROM workout_logs WHERE client_id=?1`
  ).bind(clientId).first())?.v || 0;

  // PRs
  const prs = (await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM (
       SELECT exercise_id, MAX(done_weight) AS m FROM workout_logs WHERE client_id=?1 AND done_weight IS NOT NULL GROUP BY exercise_id
     )`
  ).bind(clientId).first())?.n || 0;

  // Achieved goals
  const ag = (await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM goals WHERE client_id=?1 AND achieved_at IS NOT NULL"
  ).bind(clientId).first())?.n || 0;

  if (sessions >= 1) out.push("first_workout");
  if (sessions >= 10) out.push("sessions_10");
  if (sessions >= 50) out.push("sessions_50");
  if (sessions >= 100) out.push("sessions_100");
  if (prs >= 1) out.push("first_pr");
  if (ag >= 1) out.push("first_goal");
  if (vol >= 1000) out.push("volume_1000");
  if (vol >= 10000) out.push("volume_10000");

  // Streaks (приблизительно — считаем подряд идущих дней)
  const { results: dates } = await env.DB.prepare(
    "SELECT DISTINCT log_date FROM workout_logs WHERE client_id=?1 ORDER BY log_date DESC LIMIT 40"
  ).bind(clientId).all();
  let maxStreak = 0; let cur = 0; let prev = null;
  for (const r of (dates || [])) {
    if (prev) {
      const diff = (new Date(prev) - new Date(r.log_date)) / 86400000;
      if (diff === 1) cur += 1; else { cur = 1; }
    } else cur = 1;
    maxStreak = Math.max(maxStreak, cur);
    prev = r.log_date;
  }
  if (maxStreak >= 3) out.push("streak_3");
  if (maxStreak >= 7) out.push("streak_7");
  if (maxStreak >= 30) out.push("streak_30");

  return { codes: out, sessions, vol: Math.round(vol), prs, ag, maxStreak };
}

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const clientId = user.role === "client" ? user.id : +url.searchParams.get("client_id");
  if (!clientId) return error(400, "client_id required");
  if (user.role === "trainer") {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2").bind(clientId, user.id).first();
    if (!ok) return error(403, "forbidden");
  }
  const { codes, sessions, vol, prs, ag, maxStreak } = await computeAwards(env, clientId);
  // upsert
  for (const c of codes) {
    await env.DB.prepare("INSERT OR IGNORE INTO achievements (client_id, code) VALUES (?1, ?2)").bind(clientId, c).run();
  }
  const { results: owned } = await env.DB.prepare(
    "SELECT code, awarded_at FROM achievements WHERE client_id=?1"
  ).bind(clientId).all();
  const ownedMap = Object.fromEntries((owned || []).map((x) => [x.code, x.awarded_at]));
  const badges = BADGES.map((b) => ({ ...b, unlocked: !!ownedMap[b.code], awarded_at: ownedMap[b.code] || null }));
  return json({ badges, stats: { sessions, total_volume_kg: vol, prs, goals_done: ag, max_streak: maxStreak } });
});
