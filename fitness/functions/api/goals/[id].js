// PATCH /api/goals/[id]  — обновить, в т.ч. отметить достигнутой
// DELETE /api/goals/[id]

import { handle, requireUser, readJson, json, error } from "../../_lib.js";

async function loadGoal(env, id, user) {
  const g = await env.DB.prepare("SELECT * FROM goals WHERE id=?1").bind(id).first();
  if (!g) return null;
  if (user.role === "client" && g.client_id !== user.id) return null;
  if (user.role === "trainer") {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2").bind(g.client_id, user.id).first();
    if (!ok) return null;
  }
  return g;
}

export const onRequestPatch = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  const id = +params.id;
  const g = await loadGoal(env, id, user);
  if (!g) return error(404, "not found");
  const body = await readJson(request);
  const updates = [];
  const binds = [];
  for (const k of ["title", "target_value", "start_value", "unit", "target_date", "note", "achieved_at"]) {
    if (body[k] !== undefined) { updates.push(`${k} = ?`); binds.push(body[k]); }
  }
  if (!updates.length) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE goals SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  const id = +params.id;
  const g = await loadGoal(env, id, user);
  if (!g) return error(404, "not found");
  await env.DB.prepare("DELETE FROM goals WHERE id=?1").bind(id).run();
  return json({ ok: true });
});
