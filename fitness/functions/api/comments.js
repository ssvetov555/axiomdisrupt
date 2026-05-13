// Чат-нити, привязанные к (упражнение, клиент).
// GET /api/comments?exercise_id=...&client_id=...
// POST { exercise_id, client_id, body }

import { handle, requireUser, readJson, json, error } from "../_lib.js";

async function canAccessThread(env, user, exerciseId, clientId) {
  // Упражнение принадлежит программе, у программы trainer_id.
  const ex = await env.DB.prepare(
    `SELECT p.trainer_id FROM exercises e JOIN programs p ON p.id = e.program_id WHERE e.id = ?1`
  )
    .bind(exerciseId)
    .first();
  if (!ex) return false;
  // Клиент существует и принадлежит этому тренеру.
  const cl = await env.DB.prepare(
    "SELECT trainer_id FROM users WHERE id = ?1 AND role='client'"
  )
    .bind(clientId)
    .first();
  if (!cl) return false;
  if (cl.trainer_id !== ex.trainer_id) return false;
  if (user.role === "trainer") return user.id === ex.trainer_id;
  return user.id === clientId;
}

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const url = new URL(request.url);
  const exerciseId = +url.searchParams.get("exercise_id");
  const clientId = user.role === "client" ? user.id : +url.searchParams.get("client_id");
  if (!exerciseId || !clientId) return error(400, "exercise_id and client_id required");
  if (!(await canAccessThread(env, user, exerciseId, clientId))) return error(403, "forbidden");

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.body, c.created_at, c.author_id,
            u.role AS author_role, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.exercise_id = ?1 AND c.client_id = ?2
      ORDER BY c.created_at ASC`
  )
    .bind(exerciseId, clientId)
    .all();
  return json({ comments: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const { exercise_id, client_id, body } = await readJson(request);
  const ex = +exercise_id;
  const cl = user.role === "client" ? user.id : +client_id;
  if (!ex || !cl || !body) return error(400, "exercise_id, client_id, body required");
  if (!(await canAccessThread(env, user, ex, cl))) return error(403, "forbidden");
  const res = await env.DB.prepare(
    "INSERT INTO comments (exercise_id, client_id, author_id, body) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(ex, cl, user.id, String(body).slice(0, 4000))
    .run();
  return json({ ok: true, id: res.meta.last_row_id });
});
