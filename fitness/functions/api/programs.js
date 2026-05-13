// /api/programs
// GET — список программ тренера (с количеством упражнений)
// POST { name, description } — создать

import { handle, requireTrainer, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.description, p.created_at,
            (SELECT COUNT(*) FROM exercises e WHERE e.program_id = p.id) AS exercises_count,
            (SELECT COUNT(*) FROM assignments a WHERE a.program_id = p.id AND a.is_active = 1) AS active_assignments
       FROM programs p
      WHERE p.trainer_id = ?1
      ORDER BY p.created_at DESC`
  )
    .bind(trainer.id)
    .all();
  return json({ programs: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { name, description } = await readJson(request);
  if (!name) return error(400, "name required");
  const res = await env.DB.prepare(
    "INSERT INTO programs (trainer_id, name, description) VALUES (?1, ?2, ?3)"
  )
    .bind(trainer.id, name, description || null)
    .run();
  return json({ ok: true, id: res.meta.last_row_id });
});
