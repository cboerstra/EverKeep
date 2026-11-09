import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createAuth } from "../lib/auth.js";
import { createApp } from "../lib/app.js";
import { openDatabase, archiveDatabase, sessionStore } from "../lib/mysql.js";

const port = process.env.EVERKEEP_TEST_DB_PORT;
const origin = "https://studio.example.test";
const users = ["owner", "viewer", "other"].map(sub => ({sub, email: sub + "@example.test", email_verified:true}));

test("MySQL keeps unreviewed records and private uploads isolated, and revokes completed shares", { skip: !port }, async () => {
  const pool = openDatabase({
    host: "127.0.0.1", port: Number(port), database: "everkeep_integration", user: "root",
    password: process.env.EVERKEEP_TEST_DB_PASSWORD || "",
  });
  try {
    const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
    for (const statement of schema.split(";").map(part => part.trim()).filter(Boolean)) await pool.query(statement);
    const bytes = new Map();
    const runtime = { DB: archiveDatabase(pool), BUCKET: {
      async put(key, body) { bytes.set(key, body); },
      async get(key) { const body = bytes.get(key); return body ? { body, size: body.byteLength } : null; },
      async delete(key) { bytes.delete(key); },
    } };
    const auth = createAuth({
      origin, allowedEmails: new Set(users.map(u => u.email)), cookieKey: Buffer.alloc(32, 3), store: sessionStore(pool),
      identity: {
        begin(flow) { return new URL("https://identity.example.test/?state=" + flow.state); },
        finish(url) { return users.find(u => u.sub === url.searchParams.get("code")); },
      },
    });
    const app = createApp({ origin, runtime, auth });
    const request = (path, headers = {}, method = "GET", body) => app(new Request(origin + path, { headers, method, body }));
    const signIn = async role => {
      const start = await request("/auth/login");
      const flow = start.headers.getSetCookie()[0].split(";")[0];
      const state = new URL(start.headers.get("location")).searchParams.get("state");
      const finish = await request("/auth/callback?code=" + role + "&state=" + state, { cookie: flow });
      assert.equal(finish.status, 303);
      return finish.headers.getSetCookie().find(c => c.startsWith("__Host-everkeep-session")).split(";")[0];
    };
    const [owner, viewer, other] = await Promise.all(users.map(user => signIn(user.sub)));
    const api = (who, path, method = "GET", data) => {
      const isForm = data instanceof FormData;
      const headers = { cookie: who, origin, ...(data && !isForm ? { "Content-Type":"application/json" } : {}) };
      return request("/api/studio/" + path, headers, method, data && !isForm ? JSON.stringify(data) : data);
    };
    const json = async (pending, status = 200) => {
      const result = await pending;
      const body = await result.json();
      assert.equal(result.status, status, JSON.stringify(body));
      return body;
    };
    const { entry: preset } = await json(api(owner, "entry", "POST", {
      kind: "preset", title: "Family", status: "complete", data: { emails: [users[1].email] },
    }));
    const { entry: answer } = await json(api(owner, "entry", "POST", {
      kind: "answer", title: "A story", status: "review", preset: preset.id, data: { answer: "Fictional memory." },
    }));
    assert.equal((await json(api(viewer, "state"))).entries.length, 0);
    assert.equal((await json(api(viewer, "shared"))).entries.some(entry => entry.id === answer.id), false);
    await json(api(owner, "entry", "POST", {...answer, status: "complete"}));
    const shared = (await json(api(viewer, "shared"))).entries.find(entry => entry.id === answer.id);
    assert.ok(shared);
    assert.equal((await json(api(other, "shared"))).entries.some(entry => entry.id === answer.id), false);

    const form = new FormData();
    form.set("file", new File(["fictional document"], "test.txt", { type: "text/plain" }));
    form.set("preset", preset.id);
    const { entry: file } = await json(api(owner, "upload", "POST", form), 201);
    const filePath = "file/" + file.id + "?from=" + shared.source;
    assert.equal((await api(viewer, filePath)).status, 404);
    await json(api(owner, "entry", "POST", {...file, status: "complete"}));
    assert.equal(await (await api(viewer, filePath)).text(), "fictional document");
    assert.equal((await api(other, filePath)).status, 404);

    await json(api(owner, "entry", "POST", {
      kind: "settings", id: "settings", title: "Settings", status: "complete", data: { defaultPreset: preset.id },
    }));
    await json(api(owner, "entry/" + preset.id, "DELETE"));
    assert.equal((await api(viewer, filePath)).status, 404);
    const entries = (await json(api(owner, "state"))).entries;
    assert.equal(entries.find(entry => entry.id === answer.id).preset, "private");
    assert.equal(entries.find(entry => entry.id === "settings").data.defaultPreset, "private");
    await json(api(owner, "entry", "POST", {...preset}), 404);
    await json(api(owner, "entry/" + file.id, "DELETE"));
    assert.equal(bytes.size, 0);
  } finally {
    await pool.end();
  }
});
