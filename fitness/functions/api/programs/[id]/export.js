// GET /api/programs/[id]/export?format=json|csv — экспорт программы

import { handle, requireUser, error } from "../../../_lib.js";

export const onRequestGet = handle(async ({ request, env, params }) => {
  const user = await requireUser(env, request);
  const id = +params.id;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "json";

  const program = await env.DB.prepare(
    "SELECT id, trainer_id, name, description, difficulty, tags, duration_weeks, is_public FROM programs WHERE id=?1"
  ).bind(id).first();
  if (!program) return error(404, "not found");
  if (user.role === "trainer" && program.trainer_id !== user.id) return error(403, "forbidden");

  const { results: exercises } = await env.DB.prepare(
    `SELECT name, description, video_url, target_sets, target_reps, target_weight,
            rest_seconds, day_of_week, order_index
       FROM exercises WHERE program_id=?1 ORDER BY day_of_week, order_index, id`
  ).bind(id).all();

  const DOW = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  if (format === "csv") {
    const lines = [
      `Программа: "${program.name}"`,
      `Описание: "${program.description || ""}"`,
      ``,
      `День,Порядок,Упражнение,Подходы,Повторы,Вес,Отдых,Описание,Видео`,
    ];
    for (const e of exercises) {
      const day = e.day_of_week ? DOW[e.day_of_week] : "—";
      const row = [day, e.order_index, e.name, e.target_sets || "", e.target_reps || "", e.target_weight || "", e.rest_seconds || "", e.description || "", e.video_url || ""]
        .map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",");
      lines.push(row);
    }
    return new Response("﻿" + lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${encodeURIComponent(program.name)}.csv"`,
      },
    });
  }
  return new Response(JSON.stringify({ program, exercises }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});
