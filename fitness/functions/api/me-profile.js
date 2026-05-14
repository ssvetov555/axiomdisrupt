// PATCH /api/me-profile  { name?, bio?, avatar_url?, notes? }
// Тренер и клиент могут менять собственный профиль (имя, био, аватарка).

import { handle, requireUser, readJson, json } from "../_lib.js";

export const onRequestPatch = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const updates = [];
  const binds = [];
  for (const k of ["name", "bio", "avatar_url", "notes"]) {
    if (body[k] !== undefined) { updates.push(`${k} = ?`); binds.push(body[k]); }
  }
  if (!updates.length) return json({ ok: true });
  binds.push(user.id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});
