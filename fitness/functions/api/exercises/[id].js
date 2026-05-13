// PUT/DELETE /api/exercises/[id] — редактировать/удалить упражнение (только владелец-тренер)

import { handle, requireTrainer, readJson, json, error } from "../../_lib.js";

async function ownerCheck(env, trainerId, exId) {
  const row = await env.DB.prepare(
    `SELECT e.id FROM exercises e
       JOIN programs p ON p.id = e.program_id
      WHERE e.id = ?1 AND p.trainer_id = ?2`
  )
    .bind(exId, trainerId)
    .first();
  if (!row) throw new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

export const onRequestPut = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await ownerCheck(env, trainer.id, id);
  const body = await readJson(request);
  const fields = ["name", "description", "video_url", "target_sets", "target_reps", "target_weight", "rest_seconds", "day_of_week", "order_index"];
  const updates = [];
  const binds = [];
  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`);
      binds.push(body[f]);
    }
  }
  if (!updates.length) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE exercises SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await ownerCheck(env, trainer.id, id);
  await env.DB.prepare("DELETE FROM exercises WHERE id = ?1").bind(id).run();
  return json({ ok: true });
});
