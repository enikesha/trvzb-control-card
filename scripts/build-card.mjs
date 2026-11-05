import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/card.js"],
  outfile: "dist/trvzb-control-card.js",
  bundle: true,
  format: "iife",
  target: "es2022",
  loader: { ".html": "text", ".css": "text" },
  sourcemap: "linked",
  legalComments: "none",
  banner: {
    js: `/*!\n${await readFile(new URL("../LICENSE", import.meta.url), "utf8")}*/`,
  },
  logLevel: "info",
  write: !check,
});
if (check) {
  for (const file of result.outputFiles) {
    const committed = await readFile(file.path);
    if (!committed.equals(Buffer.from(file.contents)))
      throw new Error(
        "The distribution is stale. Run npm run build:card and commit dist/.",
      );
  }
  console.log("Distribution matches the source and lockfile dependencies.");
}
