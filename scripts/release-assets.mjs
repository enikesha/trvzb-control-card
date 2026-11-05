import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const { version } = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);
const directory = new URL(`.release/v${version}/`, root);
await mkdir(directory, { recursive: true });
const sums = [];
for (const name of ["trvzb-control-card.js", "trvzb-control-card.js.map"]) {
  const source = new URL(`dist/${name}`, root);
  await copyFile(source, new URL(name, directory));
  sums.push(
    `${createHash("sha256")
      .update(await readFile(source))
      .digest("hex")}  ${name}`,
  );
}
await copyFile(new URL("LICENSE", root), new URL("LICENSE", directory));
await copyFile(
  new URL(`docs/releases/${version}.md`, root),
  new URL("RELEASE-NOTES.md", directory),
);
await writeFile(new URL("SHA256SUMS", directory), sums.join("\n") + "\n");
console.log(`Release assets: ${decodeURIComponent(directory.pathname)}`);
