// POST /api/catalog/[id]/start — клиент сам стартует программу.
// Создаёт assignment, проверяет что программа публичная и принадлежит его тренеру.

import { handle, requireUser, json, error } from "../../../_lib.js";

export const onRequestPost = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const programId = +params.id;
  const program = await env.DB.prepare(
    "SELECT id, trainer_id, is_public FROM programs WHERE id = ?1"
  )
    .bind(programId)
    .first();
  if (!program) return error(404, "program not found");
  if (!program.is_public) return error(403, "program is not in catalog");
  if (program.trainer_id !== user.trainer_id) return error(403, "not your trainer's program");

  // Деактивируем прошлые активные assignments на эту программу для этого клиента, если есть
  await env.DB.prepare(
    "UPDATE assignments SET is_active = 0 WHERE client_id = ?1 AND program_id = ?2 AND is_active = 1"
  )
    .bind(user.id, programId)
    .run();

  const res = await env.DB.prepare(
    "INSERT INTO assignments (program_id, client_id, start_date) VALUES (?1, ?2, date('now'))"
  )
    .bind(programId, user.id)
    .run();

  return json({ ok: true, id: res.meta.last_row_id });
});
