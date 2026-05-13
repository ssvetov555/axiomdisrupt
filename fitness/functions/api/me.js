import { handle, getCurrentUser, json } from "../_lib.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const u = await getCurrentUser(env, request);
  return json({ user: u });
});
