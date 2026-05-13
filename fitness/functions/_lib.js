// Общие хелперы для всех Pages Functions:
// JSON-ответы, авторизация по cookie, хеш кода доступа.

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });

export const error = (status, message) => json({ error: message }, { status });

const COOKIE_NAME = "fit_sid";
const SESSION_TTL_DAYS = 30;

export async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.get("Cookie");
  if (!raw) return out;
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  return out;
}

export function setSessionCookie(token) {
  const maxAge = SESSION_TTL_DAYS * 24 * 3600;
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Возвращает { id, role, name, trainer_id } или null.
export async function getCurrentUser(env, req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.role, u.name, u.trainer_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?1 AND s.expires_at > datetime('now')`
  )
    .bind(token)
    .first();
  return row || null;
}

export async function requireUser(env, req) {
  const u = await getCurrentUser(env, req);
  if (!u) throw new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  return u;
}

export async function requireTrainer(env, req) {
  const u = await requireUser(env, req);
  if (u.role !== "trainer")
    throw new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "content-type": "application/json" } });
  return u;
}

// Аккуратно достаём JSON-тело запроса.
export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Корутина-обёртка: ловит брошенные Response и отдаёт их как ответ.
export const handle = (fn) => async (ctx) => {
  try {
    return await fn(ctx);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return error(500, e?.message || "internal error");
  }
};
