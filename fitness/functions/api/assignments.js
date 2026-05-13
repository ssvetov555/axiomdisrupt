// /api/assignments
// GET — список (тренер видит свои назначения, клиент — свои)
// POST { program_id, client_id, start_date?, end_date? } — назначить (тренер)

import { handle, requireUser, requireTrainer, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  let q;
  if (user.role === "trainer") {
    q = env.DB.prepare(
      `SELECT a.id, a.program_id, a.client_id, a.start_date, a.end_date, a.is_active, a.created_at,
              p.name AS program_name, u.name AS client_name
         FROM assignments a
         JOIN programs p ON p.id = a.program_id
         JOIN users u ON u.id = a.client_id
        WHERE p.trainer_id = ?1
        ORDER BY a.is_active DESC, a.created_at DESC`
    ).bind(user.id);
  } else {
    q = env.DB.prepare(
      `SELECT a.id, a.program_id, a.client_id, a.start_date, a.end_date, a.is_active, a.created_at,
              p.name AS program_name, p.description AS program_description
         FROM assignments a
         JOIN programs p ON p.id = a.program_id
        WHERE a.client_id = ?1
        ORDER BY a.is_active DESC, a.created_at DESC`
    ).bind(user.id);
  }
  const { results } = await q.all();
  return json({ assignments: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { program_id, client_id, start_date, end_date } = await readJson(request);
  if (!program_id || !client_id) return error(400, "program_id and client_id required");
  // проверим, что обе сущности принадлежат тренеру
  const program = await env.DB.prepare(
    "SELECT id FROM programs WHERE id = ?1 AND trainer_id = ?2"
  )
    .bind(program_id, trainer.id)
    .first();
  if (!program) return error(404, "program not found");
  const client = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ?1 AND trainer_id = ?2 AND role='client'"
  )
    .bind(client_id, trainer.id)
    .first();
  if (!client) return error(404, "client not found");
  const res = await env.DB.prepare(
    `INSERT INTO assignments (program_id, client_id, start_date, end_date)
     VALUES (?1, ?2, COALESCE(?3, date('now')), ?4)`
  )
    .bind(program_id, client_id, start_date || null, end_date || null)
    .run();
  return json({ ok: true, id: res.meta.last_row_id });
});
