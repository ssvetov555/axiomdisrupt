// /api/clients
// GET  — список клиентов тренера
// POST — создать клиента { name, code, notes }
//
// Удаление/обновление — /api/clients/[id].js

import { handle, requireTrainer, readJson, json, error, sha256 } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { results } = await env.DB.prepare(
    `SELECT id, name, notes, created_at
       FROM users
      WHERE role = 'client' AND trainer_id = ?1
      ORDER BY created_at DESC`
  )
    .bind(trainer.id)
    .all();
  return json({ clients: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { name, code, notes } = await readJson(request);
  if (!name || !code) return error(400, "name and code required");
  if (code.length < 4) return error(400, "code must be >= 4 chars");

  const hash = await sha256(code.trim());
  try {
    const res = await env.DB.prepare(
      `INSERT INTO users (role, name, access_code_hash, trainer_id, notes)
       VALUES ('client', ?1, ?2, ?3, ?4)`
    )
      .bind(name, hash, trainer.id, notes || null)
      .run();
    return json({ ok: true, id: res.meta.last_row_id });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return error(409, "code already in use");
    throw e;
  }
});
