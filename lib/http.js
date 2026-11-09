import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

function limitedBody(request, maxBytes) {
  let size = 0;
  return Readable.toWeb(request).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxBytes) controller.error(new Error("Request body limit exceeded."));
      else controller.enqueue(chunk);
    },
  }));
}

export function httpHandler({ app, origin }) {
  return async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, origin);
      if (url.origin !== origin) {
        outgoing.writeHead(400).end();
        return;
      }
      const { method } = incoming;
      const hasBody = method !== "GET" && method !== "HEAD";
      const maxBytes = url.pathname === "/api/studio/upload" ? 20 * 1024 * 1024 + 65536 : 100000;
      if (hasBody && Number(incoming.headers["content-length"]) > maxBytes) {
        outgoing.writeHead(413, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        outgoing.end(JSON.stringify({ error: "This upload or record is too large." }));
        return;
      }
      const request = new Request(url, {
        method,
        headers: incoming.headers,
        ...(hasBody ? { body: limitedBody(incoming, maxBytes), duplex: "half" } : {}),
      });
      const response = await app(request);
      const headers = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) headers["set-cookie"] = cookies;
      outgoing.writeHead(response.status, headers);
      if (method === "HEAD" || !response.body) outgoing.end();
      else await pipeline(Readable.fromWeb(response.body), outgoing);
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { "Cache-Control": "no-store" });
      if (!outgoing.destroyed) outgoing.end();
    }
  };
}
