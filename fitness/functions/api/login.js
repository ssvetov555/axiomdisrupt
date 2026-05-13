// POST /api/login  { code: "..." }
// По коду определяет роль (trainer/client) и выдаёт session cookie.

import { handle, readJson, json, error, sha256, randomToken, setSessionCookie } from "../_lib.js";

export const onRequestPost = handle(async ({ request, env }) => {
  const { code } = await readJson(request);
  if (!code || typeof code !== "string" || code.length < 4) {
    return error(400, "code is required (min 4 chars)");
  }
  const hash = await sha256(code.trim());
  const user = await env.DB.prepare(
    "SELECT id, role, name, trainer_id FROM users WHERE access_code_hash = ?1"
  )
    .bind(hash)
    .first();
  if (!user) return error(401, "invalid code");

  const token = randomToken();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, datetime('now', '+30 days'))"
  )
    .bind(token, user.id)
    .run();

  return json(
    { ok: true, user: { id: user.id, role: user.role, name: user.name, trainer_id: user.trainer_id } },
    { headers: { "set-cookie": setSessionCookie(token) } }
  );
});
