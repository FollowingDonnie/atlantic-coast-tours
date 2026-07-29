import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "public");
const target = join(root, "docs");

await mkdir(target, { recursive: true });
for (const entry of await readdir(target)) {
  await rm(join(target, entry), { recursive: true, force: true });
}
await cp(source, target, { recursive: true });
console.log("GitHub Pages files synced from public/ to docs/.");
