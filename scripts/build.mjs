import { cp, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
await mkdir(output, { recursive: true });
for (const item of ["server.js", "package.json", "package-lock.json", "lib", "public"]) {
  await cp(new URL(item, root), new URL(item, output), { recursive: true });
}
