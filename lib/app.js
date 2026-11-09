import { readFile } from "node:fs/promises";
import { studioAPI } from "./studio-api.ts";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
};
const assets = new Map([
  ["/studio.css", ["../public/studio.css", "text/css; charset=utf-8"]],
  ["/studio.js", ["../public/studio.js", "text/javascript; charset=utf-8"]],
  ["/studio-ui.js", ["../public/studio-ui.js", "text/javascript; charset=utf-8"]],
  ["/studio-data.js", ["../public/studio-data.js", "text/javascript; charset=utf-8"]],
  ["/everkeep.svg", ["../public/everkeep.svg", "image/svg+xml"]],
  ["/sample-avatar.jpg", ["../public/sample-avatar.jpg", "image/jpeg"]],
]);
const response = (body, status, type = "text/plain; charset=utf-8") => new Response(body, { status, headers: { ...headers, "Content-Type": type } });
const signIn = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in · Everkeep</title><link rel="icon" href="/everkeep.svg"><link rel="stylesheet" href="/studio.css"></head><body><main class="sign-in"><section class="card panel"><img src="/everkeep.svg" width="45" height="45" alt=""><div class="caps sage">PRIVATE DIGITAL SELF STUDIO</div><h1>Sign in to Everkeep</h1><p class="muted">Use the verified account approved for this studio.</p><a class="btn primary" href="/auth/login">Continue to sign in</a></section></main></body></html>';

export function createApp({ origin, auth, runtime }) {
  return async request => {
    const { pathname } = new URL(request.url);
    const { method } = request;
    try {
      if (pathname === "/auth/login" && method === "GET") return await auth.login();
      if (pathname === "/auth/callback" && method === "GET") return await auth.callback(request);
      if (pathname === "/auth/logout" && method === "POST") return await auth.logout(request);
      if (pathname.startsWith("/api/studio/")) {
        if (method !== "GET" && request.headers.get("origin") !== origin) {
          return Response.json({ error: "This request must come from your studio." }, { status: 403, headers });
        }
        return await studioAPI(request, runtime, await auth.user(request));
      }
      if (method !== "GET" && method !== "HEAD") return response(null, 405);
      if (pathname === "/") {
        const user = await auth.user(request);
        const body = method === "HEAD" ? null : user ? await readFile(new URL("../public/index.html", import.meta.url)) : signIn;
        return response(body, 200, "text/html; charset=utf-8");
      }
      const asset = assets.get(pathname);
      if (!asset) return response("Page unavailable.", 404);
      const [filename, type] = asset;
      return response(method === "HEAD" ? null : await readFile(new URL(filename, import.meta.url)), 200, type);
    } catch {
      return response("Everkeep is temporarily unavailable.", 503);
    }
  };
}
