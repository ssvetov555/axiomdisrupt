// POST /api/programs/[id]/exercises — добавить упражнение (только тренер-владелец)

import { handle, requireTrainer, readJson, json, error } from "../../../_lib.js";

export const onRequestPost = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const programId = +params.id;
  const owns = await env.DB.prepare(
    "SELECT id FROM programs WHERE id = ?1 AND trainer_id = ?2"
  )
    .bind(programId, trainer.id)
    .first();
  if (!owns) return error(404, "program not found");

  const body = await readJson(request);
  const { name, description, video_url, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index } = body;
  if (!name) return error(400, "name required");
  const res = await env.DB.prepare(
    `INSERT INTO exercises (program_id, name, description, video_url, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  )
    .bind(
      programId,
      name,
      description || null,
      video_url || null,
      target_sets || null,
      target_reps || null,
      target_weight || null,
      rest_seconds || null,
      day_of_week || null,
      order_index || 0
    )
    .run();
  return json({ ok: true, id: res.meta.last_row_id });
});
