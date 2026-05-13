// /api/programs/[id]
// GET — программа + упражнения (доступно тренеру-владельцу или клиенту с активным назначением)
// PUT — обновить (только тренер)
// DELETE — удалить (только тренер)

import { handle, requireUser, requireTrainer, readJson, json, error } from "../../_lib.js";

async function fetchProgramForUser(env, programId, user) {
  const program = await env.DB.prepare(
    "SELECT id, trainer_id, name, description, created_at FROM programs WHERE id = ?1"
  )
    .bind(programId)
    .first();
  if (!program) return null;
  if (user.role === "trainer") {
    if (program.trainer_id !== user.id) return null;
  } else {
    // клиент: должен иметь активное назначение этой программы
    const assigned = await env.DB.prepare(
      `SELECT 1 FROM assignments WHERE program_id = ?1 AND client_id = ?2 AND is_active = 1 LIMIT 1`
    )
      .bind(programId, user.id)
      .first();
    if (!assigned) return null;
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
  )
    .bind(id)
    .all();
  return json({ program, exercises });
});

export const onRequestPut = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  const program = await env.DB.prepare(
    "SELECT id FROM programs WHERE id = ?1 AND trainer_id = ?2"
  )
    .bind(id, trainer.id)
    .first();
  if (!program) return error(404, "not found");
  const { name, description } = await readJson(request);
  const updates = [];
  const binds = [];
  if (name) {
    updates.push("name = ?");
    binds.push(name);
  }
  if (description !== undefined) {
    updates.push("description = ?");
    binds.push(description);
  }
  if (!updates.length) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE programs SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  const res = await env.DB.prepare(
    "DELETE FROM programs WHERE id = ?1 AND trainer_id = ?2"
  )
    .bind(id, trainer.id)
    .run();
  if (!res.meta.changes) return error(404, "not found");
  return json({ ok: true });
});
