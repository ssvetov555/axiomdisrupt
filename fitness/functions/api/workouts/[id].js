// DELETE /api/workouts/[id] — клиент удаляет свою запись.

import { handle, requireUser, json, error } from "../../_lib.js";

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const id = +params.id;
  const res = await env.DB.prepare(
    "DELETE FROM workout_logs WHERE id = ?1 AND client_id = ?2"
  )
    .bind(id, user.id)
    .run();
  if (!res.meta.changes) return error(404, "not found");
  return json({ ok: true });
});
