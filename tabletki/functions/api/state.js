// Cloudflare Pages Function — общий серверный state для дашборда таблеток.
// Endpoint: /api/state (GET, PUT)
// Требует KV namespace binding с именем STATE в настройках Pages-проекта.
//
// Если KV не привязан:
//   GET  → возвращает пустой объект (200) — фронт продолжит работать на localStorage.
//   PUT  → 503 — фронт молча уйдёт в офлайн-режим.

const KEY = "v1";

export async function onRequestGet({ env }) {
  if (!env || !env.STATE) {
    return json({ taken: {}, settings: {}, _bound: false }, 200);
  }
  const raw = await env.STATE.get(KEY);
  if (!raw) return json({ taken: {}, settings: {}, _updated: 0 }, 200);
  return new Response(raw, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestPut({ request, env }) {
  if (!env || !env.STATE) {
    return json({ error: "kv_not_bound" }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "bad_json" }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "bad_body" }, 400);

  // sanity-фильтр: только нужные поля, и размер ограничим
  const out = {
    taken: body.taken && typeof body.taken === "object" ? body.taken : {},
    settings: body.settings && typeof body.settings === "object" ? body.settings : {},
    _updated: Date.now(),
  };
  const serialized = JSON.stringify(out);
  if (serialized.length > 100 * 1024) {
    return json({ error: "too_large" }, 413);
  }
  await env.STATE.put(KEY, serialized);
  return json({ ok: true, _updated: out._updated }, 200);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "allow": "GET, PUT, OPTIONS",
      "access-control-allow-methods": "GET, PUT, OPTIONS",
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
