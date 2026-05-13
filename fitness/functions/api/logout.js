import { handle, parseCookies, clearSessionCookie, json } from "../_lib.js";

export const onRequestPost = handle(async ({ request, env }) => {
  const c = parseCookies(request);
  const token = c["fit_sid"];
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
  }
  return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
});
