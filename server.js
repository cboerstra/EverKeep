import { createServer } from "node:http";
import { appConfig } from "./lib/config.js";
import { createApp } from "./lib/app.js";
import { createAuth } from "./lib/auth.js";
import { httpHandler } from "./lib/http.js";
import { openDatabase, archiveDatabase, sessionStore } from "./lib/mysql.js";
import { createIdentityProvider } from "./lib/oidc.js";
import { openBucket } from "./lib/storage.js";

const config = appConfig(process.env);
const pool = openDatabase(config.database);
const auth = createAuth({ ...config, store: sessionStore(pool), identity: createIdentityProvider(config.identity) });
const runtime = { ...config.avatar, DB: archiveDatabase(pool), BUCKET: openBucket(config.storage) };
const app = createApp({ origin: config.origin, auth, runtime });
const server = createServer(httpHandler({ app, origin: config.origin }));

server.listen(config.port, "0.0.0.0", () => console.log("Everkeep listening on port " + config.port));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => pool.end()));
