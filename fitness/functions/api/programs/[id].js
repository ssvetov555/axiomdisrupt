// /api/programs/[id]
// GET — программа + упражнения
// PUT — обновить (name, description, difficulty, tags, duration_weeks, is_public, is_archived)
// DELETE — удалить

import { handle, requireUser, requireTrainer, readJson, json, error } from "../../_lib.js";

async function fetchProgramForUser(env, programId, user) {
  const program = await env.DB.prepare(
    "SELECT id, trainer_id, name, description, difficulty, tags, duration_weeks, is_public, is_archived, created_at FROM programs WHERE id = ?1"
  ).bind(programId).first();
  if (!program) return null;
  if (user.role === "trainer") {
    if (program.trainer_id !== user.id) return null;
  } else {
    const assigned = await env.DB.prepare(
      `SELECT 1 FROM assignments WHERE program_id = ?1 AND client_id = ?2 AND is_active = 1 LIMIT 1`
    ).bind(programId, user.id).first();
    if (!assigned && !program.is_public) return null;
  }
  return program;
}

export const onRequestGet = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  const id = +params.id;
  const program = await fetchProgramForUser(env, id, user);
  if (!program) return error(404, "not found");
  const { results: exercises } = await env.DB.prepare(
    `SELECT id, name, description, video_url, target_sets, target_reps, target_weight,
            rest_seconds, day_of_week, order_index
       FROM exercises
      WHERE program_id = ?1
      ORDER BY COALESCE(day_of_week, 99), order_index, id`
  ).bind(id).all();
  return json({ program, exercises });
});

export const onRequestPut = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  const program = await env.DB.prepare("SELECT id FROM programs WHERE id = ?1 AND trainer_id = ?2").bind(id, trainer.id).first();
  if (!program) return error(404, "not found");

  const body = await readJson(request);
  const fields = ["name", "description", "difficulty", "tags", "duration_weeks", "is_public", "is_archived"];
  const updates = [];
  const binds = [];
  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`);
      let v = body[f];
      if (f === "tags" && typeof v !== "string") v = JSON.stringify(v);
      if (f === "is_public" || f === "is_archived") v = v ? 1 : 0;
      binds.push(v);
    }
  }
  if (!updates.length) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE programs SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  const res = await env.DB.prepare("DELETE FROM programs WHERE id = ?1 AND trainer_id = ?2").bind(id, trainer.id).run();
  if (!res.meta.changes) return error(404, "not found");
  return json({ ok: true });
});
