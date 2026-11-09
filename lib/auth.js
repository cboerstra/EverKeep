import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const sessionName = "__Host-everkeep-session";
const flowName = "__Host-everkeep-login";
const sessionSeconds = 7 * 24 * 60 * 60;
const flowSeconds = 10 * 60;
const opaque = () => randomBytes(32).toString("base64url");
const digest = value => createHash("sha256").update(value).digest("hex");
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

function cookie(name, value, seconds) {
  return name + "=" + value + "; Path=/; Max-Age=" + seconds + "; HttpOnly; Secure; SameSite=Lax";
}

function readCookie(request, name) {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="))?.slice(name.length + 1);
}

function seal(flow, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(flow), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function unseal(value, key) {
  if (!value || !/^[A-Za-z0-9_-]{38,1200}$/.test(value)) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const flow = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    return flow.expires > Date.now() ? flow : null;
  } catch {
    return null;
  }
}

function redirect(location, cookies) {
  const headers = new Headers({ ...noStore, Location: location });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 303, headers });
}

function denied() {
  return new Response("Sign-in was declined. Open Everkeep again to retry.", {
    status: 403,
    headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": cookie(flowName, "", 0) },
  });
}

export function createAuth({ origin, allowedEmails, cookieKey, store, identity }) {
  const sessionHash = request => {
    const token = readCookie(request, sessionName);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? digest(token) : null;
  };

  return {
    async user(request) {
      const hash = sessionHash(request);
      if (!hash) return null;
      const user = await store.getSession(hash, Date.now());
      return user && allowedEmails.has(user.email) ? user : null;
    },

    async login() {
      const flow = { state: opaque(), nonce: opaque(), verifier: opaque(), expires: Date.now() + flowSeconds * 1000 };
      const destination = await identity.begin(flow);
      return redirect(destination.href, [cookie(flowName, seal(flow, cookieKey), flowSeconds)]);
    },

    async callback(request) {
      const flow = unseal(readCookie(request, flowName), cookieKey);
      const url = new URL(request.url);
      if (!flow || url.searchParams.get("state") !== flow.state || !url.searchParams.has("code")) return denied();
      let claims;
      try { claims = await identity.finish(url, flow); } catch { return denied(); }
      const email = typeof claims?.email === "string" ? claims.email.toLowerCase().trim() : "";
      if (claims?.email_verified !== true || !allowedEmails.has(email) || typeof claims.sub !== "string" || !claims.sub) return denied();
      const displayName = (typeof claims.name === "string" && claims.name.trim().slice(0, 255)) || email;
      const token = opaque();
      const subject = digest((claims.iss || identity.issuer || "") + "\0" + claims.sub);
      await store.createSession(subject, { email, displayName }, digest(token), Date.now() + sessionSeconds * 1000, sessionHash(request));
      return redirect("/", [cookie(flowName, "", 0), cookie(sessionName, token, sessionSeconds)]);
    },

    async logout(request) {
      if (request.headers.get("origin") !== origin) return denied();
      const hash = sessionHash(request);
      if (hash) await store.deleteSession(hash);
      return redirect("/", [cookie(sessionName, "", 0), cookie(flowName, "", 0)]);
    },
  };
}
