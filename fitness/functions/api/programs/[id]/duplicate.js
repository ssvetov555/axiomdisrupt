// POST /api/programs/[id]/duplicate — копирует программу со всеми упражнениями.

import { handle, requireTrainer, json, error } from "../../../_lib.js";

export const onRequestPost = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  const program = await env.DB.prepare(
    "SELECT name, description, difficulty, tags, duration_weeks FROM programs WHERE id=?1 AND trainer_id=?2"
  ).bind(id, trainer.id).first();
  if (!program) return error(404, "not found");

  const res = await env.DB.prepare(
    `INSERT INTO programs (trainer_id, name, description, difficulty, tags, duration_weeks)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(trainer.id, `${program.name} (копия)`, program.description, program.difficulty, program.tags, program.duration_weeks).run();
  const newId = res.meta.last_row_id;

  await env.DB.prepare(
    `INSERT INTO exercises (program_id, name, description, video_url, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index)
     SELECT ?1, name, description, video_url, target_sets, target_reps, target_weight, rest_seconds, day_of_week, order_index
       FROM exercises WHERE program_id=?2`
  ).bind(newId, id).run();

  return json({ ok: true, id: newId });
});
