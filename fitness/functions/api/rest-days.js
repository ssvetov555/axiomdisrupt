// POST /api/rest-days  { date?, reason? } — клиент отмечает выходной
// DELETE /api/rest-days?date=YYYY-MM-DD — снять отметку
// GET /api/rest-days?from=&to= — список

import { handle, requireUser, readJson, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "1900-01-01";
  const to = url.searchParams.get("to") || "2999-12-31";
  const { results } = await env.DB.prepare(
    "SELECT log_date, reason FROM rest_days WHERE client_id=?1 AND log_date BETWEEN ?2 AND ?3 ORDER BY log_date DESC"
  ).bind(user.id, from, to).all();
  return json({ days: results });
});

export const onRequestPost = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const { date, reason } = await readJson(request);
  const d = date || new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO rest_days (client_id, log_date, reason) VALUES (?1, ?2, ?3)`
  ).bind(user.id, d, reason || null).run();
  return json({ ok: true, date: d });
});

export const onRequestDelete = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  if (user.role !== "client") return error(403, "only client");
  const url = new URL(request.url);
  const d = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  await env.DB.prepare("DELETE FROM rest_days WHERE client_id=?1 AND log_date=?2").bind(user.id, d).run();
  return json({ ok: true });
});
