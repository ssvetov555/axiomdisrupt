// /api/programs
// GET ?include_archived=1 — список программ тренера (с архивом или без)
// POST { name, description, difficulty, tags, duration_weeks } — создать

import { handle, requireTrainer, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("include_archived") === "1";
  const sql = `
    SELECT p.id, p.name, p.description, p.difficulty, p.tags, p.duration_weeks,
           p.is_public, p.is_archived, p.created_at,
           (SELECT COUNT(*) FROM exercises e WHERE e.program_id = p.id) AS exercises_count,
           (SELECT COUNT(*) FROM assignments a WHERE a.program_id = p.id AND a.is_active = 1) AS active_assignments,
           (SELECT ROUND(AVG(stars),1) FROM program_ratings r WHERE r.program_id = p.id) AS avg_stars,
           (SELECT COUNT(*) FROM program_ratings r WHERE r.program_id = p.id) AS ratings_count
      FROM programs p
     WHERE p.trainer_id = ?1
       AND (?2 = 1 OR p.is_archived = 0)
     ORDER BY p.is_archived ASC, p.created_at DESC`;
  const { results } = await env.DB.prepare(sql).bind(trainer.id, includeArchived ? 1 : 0).all();
  return json({ programs: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { name, description, difficulty, tags, duration_weeks } = await readJson(request);
  if (!name) return error(400, "name required");
  const res = await env.DB.prepare(
    `INSERT INTO programs (trainer_id, name, description, difficulty, tags, duration_weeks)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(
    trainer.id,
    name,
    description || null,
    difficulty || null,
    tags ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : null,
    duration_weeks || null
  ).run();
  return json({ ok: true, id: res.meta.last_row_id });
});
