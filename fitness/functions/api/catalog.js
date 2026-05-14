// GET /api/catalog — список публичных программ тренера + рейтинг + статистика.
// Видят и тренер (только своего), и клиент (только своего тренера).

import { handle, requireUser, json, error } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const user = await requireUser(env, request);
  const trainerId = user.role === "trainer" ? user.id : user.trainer_id;
  if (!trainerId) return error(403, "no trainer");

  const { results } = await env.DB.prepare(
    `SELECT
        p.id, p.name, p.description, p.created_at,
        p.is_public,
        (SELECT COUNT(*) FROM exercises e WHERE e.program_id = p.id) AS exercises_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.program_id = p.id AND a.is_active = 1) AS active_users,
        (SELECT ROUND(AVG(stars), 1) FROM program_ratings r WHERE r.program_id = p.id) AS avg_stars,
        (SELECT COUNT(*) FROM program_ratings r WHERE r.program_id = p.id) AS ratings_count,
        ${
          user.role === "client"
            ? `(SELECT 1 FROM assignments a WHERE a.program_id = p.id AND a.client_id = ?2 AND a.is_active = 1 LIMIT 1) AS is_mine,
               (SELECT stars FROM program_ratings r WHERE r.program_id = p.id AND r.client_id = ?2) AS my_stars`
            : `NULL AS is_mine, NULL AS my_stars`
        }
     FROM programs p
     WHERE p.trainer_id = ?1
       AND (?3 = 1 OR p.is_public = 1)
     ORDER BY ratings_count DESC, avg_stars DESC, p.created_at DESC`
  )
    .bind(trainerId, user.id, user.role === "trainer" ? 1 : 0)
    .all();

  return json({ programs: results });
});
