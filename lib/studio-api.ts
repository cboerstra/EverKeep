type ArchiveStatement = {
  run(): Promise<unknown>;
  first<T>(): Promise<T | null | undefined>;
  all<T>(): Promise<{ results: T[] }>;
};
type Runtime = {
  DB?: { prepare(sql: string): { bind(...args: unknown[]): ArchiveStatement }; batch(statements: ArchiveStatement[]): Promise<unknown> };
  BUCKET?: {
    put(key: string, bytes: ArrayBuffer, options: { httpMetadata: { contentType: string } }): Promise<void>;
    get(key: string): Promise<{ body: ReadableStream; size: number; arrayBuffer(): Promise<ArrayBuffer> } | null>;
    delete(key: string): Promise<void>;
  };
  AVATAR_API_URL?: string;
  AVATAR_API_TOKEN?: string;
  AVATAR_PREVIEW_ORIGIN?: string;
};
type Identity = { userId: string; email: string; displayName: string };
type Entry = { owner: string; id: string; kind: string; title: string; payload: string; status: string; preset: string; updated: number };
type Data = Record<string, unknown>;

const fields: Record<string, Record<string, number>> = {
  profile: { name: 150, pronouns: 80, location: 150, birth: 10, bio: 8000 },
  traits: { values: 5000, tone: 1000, boundaries: 5000 },
  avatar: { look: 60, voice: 60, notes: 3000, portrait: 64, recording: 64 },
  settings: { defaultPreset: 64, wishes: 5000 },
  answer: { answer: 12000, topic: 120, parent: 64 },
  preset: { description: 1000 },
};
const fixed = new Set(["profile", "traits", "avatar", "settings"]);
const shareable = "e.status='complete' AND e.kind IN ('profile','traits','answer','asset')";
const safeId = /^[a-z0-9][a-z0-9-]{0,63}$/;
const maxBytes = 20 * 1024 * 1024;
const allowedFiles = new Set([
  "application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/webp", "image/gif", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
  "audio/ogg", "audio/webm", "video/mp4", "video/webm", "video/quicktime",
]);
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const error = (message: string, status = 400) => json({ error: message }, status);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isRecord = (value: unknown): value is Data => typeof value === "object" && value !== null && !Array.isArray(value);
const dataOf = (entry: Entry) => JSON.parse(entry.payload) as Data;
const entryView = ({ owner, payload, ...entry }: Entry) => ({ ...entry, data: JSON.parse(payload) as Data });
const stringList = (value: unknown, width: number, count: number) => Array.isArray(value)
  ? [...new Set(value.map(x => clean(x, width)).filter(Boolean))].slice(0, count)
  : [];

export async function studioAPI(request: Request, runtime: Runtime, user: Identity | null): Promise<Response> {
  if (!user) return error("Sign in to open your private studio.", 401);
  const db = runtime.DB;
  const bucket = runtime.BUCKET;
  if (!db) return error("The archive database is unavailable.", 503);
  const owner = user.userId;
  const email = user.email.toLowerCase();
  const url = new URL(request.url);
  const [, , , route, key, extra] = url.pathname.split("/");
  const method = request.method;
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== url.origin)) {
      return error("This request must come from your studio.", 403);
    }
  }
  const byId = (id: string) => db.prepare("SELECT * FROM entries WHERE owner=? AND id=?").bind(owner, id).first<Entry>();
  const validPreset = async (id: string) => id === "private" || (safeId.test(id) && (await byId(id))?.kind === "preset");
  const insert = (e: Entry) => db.prepare("INSERT INTO entries (owner,id,kind,title,payload,status,preset,updated) VALUES (?,?,?,?,?,?,?,?)").bind(owner,e.id,e.kind,e.title,e.payload,e.status,e.preset,e.updated);
  const update = (e: Entry) => db.prepare("UPDATE entries SET title=?,payload=?,status=?,preset=?,updated=? WHERE owner=? AND id=? AND kind=?").bind(e.title,e.payload,e.status,e.preset,e.updated,owner,e.id,e.kind);
  const upsertFixed = (e: Entry) => db.prepare("INSERT INTO entries (owner,id,kind,title,payload,status,preset,updated) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),payload=VALUES(payload),status=VALUES(status),preset=VALUES(preset),updated=VALUES(updated)").bind(owner,e.id,e.kind,e.title,e.payload,e.status,e.preset,e.updated);

  try {
    if (method === "GET" && route === "state" && !key) {
      const { results } = await db.prepare("SELECT * FROM entries WHERE owner=? ORDER BY updated DESC").bind(owner).all<Entry>();
      return json({ account: { name: user.displayName, email: user.email }, entries: results.map(entryView), avatarService: Boolean(runtime.AVATAR_API_URL) });
    }

    if (method === "GET" && route === "shared" && !key) {
      const { results } = await db.prepare(
        "SELECT e.* FROM entries e JOIN viewers v ON e.owner=v.owner AND e.preset=v.preset WHERE v.email=? AND e.owner<>? AND " + shareable + " ORDER BY e.updated DESC"
      ).bind(email, owner).all<Entry>();
      return json({ entries: results.map(row => ({ ...entryView(row), source: row.owner })) });
    }

    if (method === "POST" && route === "entry" && !key) {
      if (Number(request.headers.get("content-length")) > 100000) return error("This record is too large.", 413);
      const body = await request.json().catch(() => null);
      if (!isRecord(body) || !isRecord(body.data)) return error("Enter the details for this record.");
      const kind = clean(body.kind, 40);
      const requestedId = typeof body.id === "string" ? body.id : "";
      const id = requestedId || crypto.randomUUID();
      if ((!Object.hasOwn(fields, kind) && kind !== "asset") || !safeId.test(id) || (fixed.has(kind) ? id !== kind : fixed.has(id) || id === "private")) return error("Invalid record.");
      const existing = await byId(id);
      if (existing && existing.kind !== kind) return error("This record already exists.", 409);
      if (!existing && (kind === "asset" || (requestedId && !fixed.has(kind)))) return error("This record is unavailable.", 404);
      const title = clean(body.title, 300);
      const status = clean(body.status, 20);
      const preset = ["avatar", "settings", "preset"].includes(kind) ? "private" : clean(body.preset, 64) || "private";
      if (!title || !["draft","review","complete"].includes(status) || !(await validPreset(preset))) return error("Check the title, review status, and sharing preset.");
      const input = body.data;
      const data: Data = kind === "asset" && existing ? dataOf(existing) : Object.fromEntries(
        Object.entries(fields[kind]).map(([name, max]) => [name, clean(input[name], max)])
      );
      if (kind === "answer" && !data.answer) return error("Write an answer before saving.");
      if (kind === "traits") data.traits = stringList(input.traits, 65, 24);
      if (kind === "settings" && !(await validPreset(String(data.defaultPreset || "private")))) return error("Choose an existing default preset.");
      if (kind === "avatar") {
        data.consent = input.consent === true;
        for (const [field, prefix] of [["portrait", "image/"], ["recording", "audio/"]]) {
          const selected = String(data[field]);
          if (!selected) continue;
          const media = await byId(selected);
          if (media?.kind !== "asset" || !String(dataOf(media).mime).startsWith(prefix)) return error("Choose matching media from your archive.");
        }
      }
      if (kind === "preset") {
        data.emails = [...new Set(stringList(input.emails, 254, 30).map(x => x.toLowerCase()))];
        if ((data.emails as string[]).some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return error("Enter a valid email address for each viewer.");
      }
      const entry = { owner, id, kind, title, status, preset, payload: JSON.stringify(data), updated: Date.now() };
      const save = fixed.has(kind) ? upsertFixed(entry) : existing ? update(entry) : insert(entry);
      if (kind === "preset") {
        await db.batch([
          save,
          db.prepare("DELETE FROM viewers WHERE owner=? AND preset=?").bind(owner, id),
          ...(data.emails as string[]).map(address => db.prepare("INSERT INTO viewers (owner,preset,email) VALUES (?,?,?)").bind(owner, id, address)),
        ]);
      } else await save.run();
      return json({ entry: entryView(entry) });
    }

    if (method === "POST" && route === "upload" && !key) {
      if (!bucket) return error("File storage is unavailable.", 503);
      if (Number(request.headers.get("content-length")) > maxBytes + 65536) return error("Files can be up to 20 MB.", 413);
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File) || !file.size || file.size > maxBytes || !allowedFiles.has(file.type)) {
        return error("Choose a supported image, audio, video, PDF, Word, or text file up to 20 MB.");
      }
      const preset = clean(form?.get("preset"), 64) || "private";
      if (!(await validPreset(preset))) return error("Choose an existing sharing preset.");
      const id = crypto.randomUUID();
      const filename = clean(file.name, 300);
      const title = clean(form?.get("title"), 300) || filename || "Archive file";
      const payload = JSON.stringify({ mime: file.type, size: file.size, filename, category: clean(form?.get("category"), 60) });
      const entry = { owner, id, kind: "asset", title, payload, status: "review", preset, updated: Date.now() };
      const objectKey = owner + "/" + id;
      await bucket.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      try { await insert(entry).run(); }
      catch (failure) { await bucket.delete(objectKey).catch(() => {}); throw failure; }
      return json({ entry: entryView(entry) }, 201);
    }

    if (method === "GET" && route === "file" && key && safeId.test(key) && !extra) {
      const source = url.searchParams.get("from");
      const row = source ? await db.prepare(
        "SELECT e.* FROM entries e JOIN viewers v ON v.owner=e.owner AND v.preset=e.preset WHERE e.owner=? AND e.id=? AND v.email=? AND " + shareable
      ).bind(source, key, email).first<Entry>() : await byId(key);
      if (!row || row.kind !== "asset" || !bucket) return error("File unavailable.", 404);
      const file = await bucket.get(row.owner + "/" + row.id);
      if (!file) return error("File unavailable.", 404);
      const { mime, filename } = dataOf(row);
      const media = /^(image|audio|video)\//.test(String(mime)) && allowedFiles.has(String(mime));
      const name = String(filename || "archive-file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const disposition = media && url.searchParams.get("download") !== "1" ? "inline" : "attachment";
      return new Response(file.body, { headers: {
        ...headers, "Content-Type": media ? String(mime) : "application/octet-stream",
        "Content-Disposition": disposition + '; filename="' + name + '"', "Content-Length": String(file.size),
        "Content-Security-Policy": "default-src 'none'; sandbox",
      } });
    }

    if (method === "DELETE" && route === "entry" && key && safeId.test(key) && !extra) {
      const row = await byId(key);
      if (!row || fixed.has(row.kind)) return error("Record unavailable.", 404);
      if (row.kind === "asset") {
        if (!bucket) return error("File storage is unavailable.", 503);
        const avatar = await byId("avatar");
        const data = avatar && dataOf(avatar);
        if (data?.portrait === key || data?.recording === key) return error("Remove this file from your avatar settings before deleting it.", 409);
        await bucket.delete(owner + "/" + key);
      }
      if (row.kind === "preset") {
        await db.batch([
          db.prepare("DELETE FROM viewers WHERE owner=? AND preset=?").bind(owner, key),
          db.prepare("UPDATE entries SET preset='private' WHERE owner=? AND preset=?").bind(owner, key),
          db.prepare("UPDATE entries SET payload=json_set(payload,'$.defaultPreset','private') WHERE owner=? AND kind='settings' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.defaultPreset'))=?").bind(owner, key),
          db.prepare("DELETE FROM entries WHERE owner=? AND id=?").bind(owner, key),
        ]);
      } else await db.prepare("DELETE FROM entries WHERE owner=? AND id=?").bind(owner, key).run();
      return json({ ok: true });
    }

    if (method === "POST" && route === "avatar-preview" && !key) {
      if (!runtime.AVATAR_API_URL || !bucket) return error("The avatar service is disconnected.", 503);
      const avatar = await byId("avatar");
      const options = avatar && dataOf(avatar);
      if (!options || options.consent !== true || !options.portrait) return error("Choose a portrait and save your consent first.");
      const endpoint = new URL(runtime.AVATAR_API_URL);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return error("The avatar service is misconfigured.", 503);
      const form = new FormData();
      for (const [field, prefix] of [["portrait", "image/"], ["recording", "audio/"]]) {
        const id = String(options[field] || "");
        if (!id) continue;
        const record = await byId(id);
        if (record?.kind !== "asset" || !String(dataOf(record).mime).startsWith(prefix)) return error("The selected avatar media is unavailable.");
        const file = await bucket.get(owner + "/" + id);
        if (!file) return error("The selected avatar media is unavailable.");
        const metadata = dataOf(record);
        form.set(field, new Blob([await file.arrayBuffer()], { type: String(metadata.mime) }), String(metadata.filename));
      }
      form.set("look", String(options.look));
      form.set("voice", String(options.voice));
      const response = await fetch(endpoint, { method: "POST", body: form, redirect: "error",
        headers: runtime.AVATAR_API_TOKEN ? { Authorization: "Bearer " + runtime.AVATAR_API_TOKEN } : {},
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return error("The avatar provider could not open a session.", 502);
      const payload = await response.json() as { previewUrl?: string };
      if (!payload.previewUrl) return error("The avatar provider returned no preview.", 502);
      const preview = new URL(payload.previewUrl);
      if (preview.protocol !== "https:" || preview.origin !== (runtime.AVATAR_PREVIEW_ORIGIN || endpoint.origin) || preview.username || preview.password) {
        return error("The avatar provider returned an unrecognized preview link.", 502);
      }
      return json({ previewUrl: preview.href });
    }

    return error("This studio action is unavailable.", 404);
  } catch {
    return error("Your studio could not complete that request. Please try again.", 503);
  }
}
