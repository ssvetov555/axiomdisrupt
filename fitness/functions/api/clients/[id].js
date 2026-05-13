import { handle, requireTrainer, readJson, json, error, sha256 } from "../../_lib.js";

async function ensureOwnership(env, trainerId, clientId) {
  const row = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ?1 AND trainer_id = ?2 AND role = 'client'"
  )
    .bind(clientId, trainerId)
    .first();
  if (!row) throw new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

export const onRequestPut = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await ensureOwnership(env, trainer.id, id);
  const { name, code, notes } = await readJson(request);
  const updates = [];
  const binds = [];
  if (name) {
    updates.push("name = ?");
    binds.push(name);
  }
  if (notes !== undefined) {
    updates.push("notes = ?");
    binds.push(notes);
  }
  if (code) {
    if (code.length < 4) return error(400, "code must be >= 4 chars");
    updates.push("access_code_hash = ?");
    binds.push(await sha256(code.trim()));
  }
  if (updates.length === 0) return json({ ok: true });
  binds.push(id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
});

export const onRequestDelete = handle(async ({ request, env, params }) => {
  const trainer = await requireTrainer(env, request);
  const id = +params.id;
  await ensureOwnership(env, trainer.id, id);
  await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
  return json({ ok: true });
});
