// PATCH /api/assignments/[id]  { is_active }
// DELETE /api/assignments/[id]

import { handle, requireTrainer, readJson, json, error } from "../../_lib.js";

async function trainerOwns(env, trainerId, asgId) {
  const row = await env.DB.prepare(
    `SELECT a.id FROM assignments a
       JOIN programs p ON p.id = a.program_id
      WHERE a.id = ?1 AND p.trainer_id = ?2`
  )
    .bind(asgId, trainerId)
    .first();
  if (!row) throw new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

export const onRequestPatch = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await trainerOwns(env, trainer.id, id);
  const { is_active, end_date } = await readJson(request);
  const updates = [];
  const binds = [];
  if (is_active !== undefined) {
    updates.push("is_active = ?");
    binds.push(is_active ? 1 : 0);
  }
  if (end_date !== undefined) {
    updates.push("end_date = ?");
    binds.push(end_date);
  }
  if (!updates.length) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE assignments SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await trainerOwns(env, trainer.id, id);
  await env.DB.prepare("DELETE FROM assignments WHERE id = ?1").bind(id).run();
  return json({ ok: true });
});
