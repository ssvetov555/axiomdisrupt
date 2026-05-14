// POST /api/assignments/bulk { program_id, client_ids: [..], start_date? }
// Назначает программу нескольким клиентам сразу.

import { handle, requireTrainer, readJson, json, error } from "../../_lib.js";

export const onRequestPost = handle(async ({ request, env }) => {
  const trainer = await requireTrainer(env, request);
  const { program_id, client_ids, start_date } = await readJson(request);
  if (!program_id || !Array.isArray(client_ids) || !client_ids.length) return error(400, "program_id and client_ids required");

  const program = await env.DB.prepare("SELECT id FROM programs WHERE id=?1 AND trainer_id=?2").bind(program_id, trainer.id).first();
  if (!program) return error(404, "program not found");

  let created = 0;
  for (const cid of client_ids) {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE id=?1 AND trainer_id=?2 AND role='client'").bind(cid, trainer.id).first();
    if (!ok) continue;
    await env.DB.prepare(
      `INSERT INTO assignments (program_id, client_id, start_date) VALUES (?1, ?2, COALESCE(?3, date('now')))`
    ).bind(program_id, cid, start_date || null).run();
    created++;
  }
  return json({ ok: true, created });
});
