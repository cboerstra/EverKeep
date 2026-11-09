import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuth } from "../lib/auth.js";
import { createApp } from "../lib/app.js";

const origin = "https://studio.example.test";
const owner = { sub: "provider-owner", email: "owner@example.test", email_verified: true, name: "Owner" };
const viewer = { sub: "provider-viewer", email: "viewer@example.test", email_verified: true, name: "Viewer" };

function fixture(claims = owner) {
  const sessions = new Map();
  const identity = {
    begin(flow) { return new URL("https://identity.example.test/?state=" + flow.state); },
    async finish(url, flow) {
      if (url.searchParams.get("state") !== flow.state) throw new Error("Invalid state");
      return claims;
    },
  };
  const store = {
    async createSession(subject, account, hash) {
      const userId = subject;
      sessions.set(hash, { userId, ...account });
    },
    async getSession(hash) { return sessions.get(hash); },
    async deleteSession(hash) { sessions.delete(hash); },
  };
  const auth = createAuth({
    origin, allowedEmails: new Set([owner.email, viewer.email]), cookieKey: Buffer.alloc(32, 9), store, identity,
  });
  const app = createApp({
    origin, auth, runtime: { DB: {
      prepare() { return { bind: id => ({ all: () => ({results: [{owner:id,id:"a",kind:"answer",title:"Test",payload:"{}",status:"draft",preset:"private",updated:0}]}) }) }; },
    } },
  });
  return { app };
}

const request = (app, path, init) => app(new Request(origin + path, init));
const cookies = response => response.headers.getSetCookie().map(value => value.split(";")[0]);
async function begin(app) {
  const start = await request(app, "/auth/login");
  assert.equal(start.status, 303);
  assert.match(start.headers.getSetCookie()[0], /;\s*HttpOnly; Secure; SameSite=Lax/);
  return { state: new URL(start.headers.get("location")).searchParams.get("state"), flow: cookies(start)[0] };
}
async function callback(app, state, cookie) {
  return request(app, "/auth/callback?code=test&state=" + encodeURIComponent(state), { headers: { cookie } });
}

test("the dashboard requires sign-in and client identity headers cannot open the archive", async () => {
  const { app } = fixture();
  assert.match(await (await request(app, "/")).text(), /Sign in to Everkeep/);
  const response = await request(app, "/api/studio/state", { headers: {
    "oai-authenticated-user-id": "owner", "oai-authenticated-user-email": owner.email,
  } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("a verified, allowlisted identity can open its archive and sign out", async () => {
  const { app } = fixture();
  const { state, flow } = await begin(app);
  const result = await callback(app, state, flow);
  assert.equal(result.status, 303);
  const cookie = cookies(result).find(value => value.startsWith("__Host-everkeep-session="));
  const signedIn = await request(app, "/api/studio/state", { headers: { cookie } });
  assert.equal(signedIn.status, 200);
  assert.equal((await signedIn.json()).account.email, owner.email);
  assert.equal((await request(app, "/auth/logout", { method: "POST", headers: { cookie, origin: "https://attacker.example.test" } })).status, 403);
  assert.equal((await request(app, "/auth/logout", { method: "POST", headers: { cookie, origin } })).status, 303);
  assert.equal((await request(app, "/api/studio/state", { headers: { cookie } })).status, 401);
});

test("wrong or tampered login state and unapproved identities fail closed", async () => {
  const { app } = fixture();
  const { state, flow } = await begin(app);
  assert.equal((await callback(app, state + "-wrong", flow)).status, 403);
  assert.equal((await callback(app, state, flow + "corrupted")).status, 403);
  for (const claims of [{...owner,email_verified:false}, {...owner,email:"unapproved@example.test"}]) {
    const { app } = fixture(claims);
    const { state, flow } = await begin(app);
    assert.equal((await callback(app, state, flow)).status, 403);
  }
});
