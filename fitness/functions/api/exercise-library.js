// GET /api/exercise-library?q=... — поиск по библиотеке упражнений для автодополнения

import { handle, requireTrainer, json } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  await requireTrainer(env, request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const sql = q
    ? `SELECT id, name, muscle_group, equipment, description, video_url
         FROM exercise_library
        WHERE name LIKE ?1
        ORDER BY name LIMIT 30`
    : `SELECT id, name, muscle_group, equipment, description, video_url
         FROM exercise_library
        ORDER BY name LIMIT 30`;
  const stmt = q ? env.DB.prepare(sql).bind(`%${q}%`) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ items: results });
});
