function required(env, name) {
  if (!env[name]?.trim()) throw new Error("Set " + name + " in the hosting environment.");
  return env[name];
}

function httpsUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(name + " must be a valid HTTPS URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error(name + " must be an HTTPS URL without credentials or a fragment.");
  return url;
}

function positivePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(name + " must be a valid TCP port.");
  return port;
}

export function mysqlConfig(env) {
  return {
    host: env.DB_HOST || "127.0.0.1",
    port: positivePort(env.DB_PORT || "3306", "DB_PORT"),
    database: required(env, "DB_NAME"),
    user: required(env, "DB_USER"),
    password: required(env, "DB_PASSWORD"),
  };
}

export function appConfig(env) {
  const origin = httpsUrl(required(env, "APP_ORIGIN"), "APP_ORIGIN");
  if (origin.pathname !== "/" || origin.search) throw new Error("APP_ORIGIN must be an origin without a path or query.");
  const issuer = httpsUrl(required(env, "OIDC_ISSUER"), "OIDC_ISSUER");
  const cookieKey = Buffer.from(required(env, "SESSION_SECRET"), "base64");
  if (cookieKey.length !== 32) throw new Error("SESSION_SECRET must be 32 random bytes encoded as base64.");
  const owner = required(env, "STUDIO_OWNER_EMAIL");
  const allowedEmails = new Set([owner, ...(env.STUDIO_ALLOWED_EMAILS || "").split(",")].map(email => email.trim().toLowerCase()).filter(Boolean));
  if ([...allowedEmails].some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Check the configured owner and viewer email addresses.");
  const bucket = required(env, "S3_BUCKET");
  const endpoint = env.S3_ENDPOINT ? httpsUrl(env.S3_ENDPOINT, "S3_ENDPOINT").href : undefined;
  return {
    port: positivePort(env.PORT || "3000", "PORT"),
    origin: origin.origin,
    cookieKey,
    allowedEmails,
    identity: {
      issuer: issuer.href.replace(/\/$/, ""),
      clientId: required(env, "OIDC_CLIENT_ID"),
      clientSecret: required(env, "OIDC_CLIENT_SECRET"),
      origin: origin.origin,
    },
    database: mysqlConfig(env),
    storage: {
      bucket, endpoint, region: required(env, "S3_REGION"),
      accessKeyId: required(env, "S3_ACCESS_KEY_ID"), secretAccessKey: required(env, "S3_SECRET_ACCESS_KEY"),
    },
    avatar: {
      AVATAR_API_URL: env.AVATAR_API_URL ? httpsUrl(env.AVATAR_API_URL, "AVATAR_API_URL").href : undefined,
      AVATAR_API_TOKEN: env.AVATAR_API_TOKEN,
      AVATAR_PREVIEW_ORIGIN: env.AVATAR_PREVIEW_ORIGIN ? httpsUrl(env.AVATAR_PREVIEW_ORIGIN, "AVATAR_PREVIEW_ORIGIN").origin : undefined,
    },
  };
}
