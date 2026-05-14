// GET /api/programs/[id]/ratings — список оценок
// POST { stars, review } — клиент оставляет/обновляет оценку

import { handle, requireUser, readJson, json, error } from "../../../_lib.js";

async function userCanAccessProgram(env, user, programId) {
  const p = await env.DB.prepare(
    "SELECT trainer_id, is_public FROM programs WHERE id = ?1"
  ).bind(programId).first();
  if (!p) return false;
  if (user.role === "trainer") return p.trainer_id === user.id;
  if (p.trainer_id !== user.trainer_id) return false;
  return p.is_public === 1 || true; // клиенту своего тренера — да
}

export const onRequestGet = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  const programId = +params.id;
  if (!(await userCanAccessProgram(env, user, programId))) return error(403, "forbidden");
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.stars, r.review, r.created_at, r.client_id,
            u.name AS client_name
       FROM program_ratings r
       JOIN users u ON u.id = r.client_id
      WHERE r.program_id = ?1
      ORDER BY r.created_at DESC`
  ).bind(programId).all();
  return json({ ratings: results });
});

export const onRequestPost = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client can rate");
  const programId = +params.id;
  if (!(await userCanAccessProgram(env, user, programId))) return error(403, "forbidden");
  const { stars, review } = await readJson(request);
  const s = Math.round(+stars);
  if (!(s >= 1 && s <= 5)) return error(400, "stars must be 1..5");

  // upsert: одна оценка на (program, client)
  await env.DB.prepare(
    `INSERT INTO program_ratings (program_id, client_id, stars, review)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(program_id, client_id) DO UPDATE SET stars = excluded.stars, review = excluded.review, created_at = datetime('now')`
  ).bind(programId, user.id, s, review || null).run();

  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const programId = +params.id;
  await env.DB.prepare(
    "DELETE FROM program_ratings WHERE program_id = ?1 AND client_id = ?2"
  ).bind(programId, user.id).run();
  return json({ ok: true });
});
