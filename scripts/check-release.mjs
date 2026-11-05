import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(await read("package.json"));
const hacs = JSON.parse(await read("hacs.json"));
assert.equal(pkg.name, "trvzb-control-card");
assert.equal(pkg.license, "MIT");
assert.equal(hacs.filename, `${pkg.name}.js`);
assert.equal(hacs.content_in_root ?? false, false);
assert.match(await read("LICENSE"), /MIT License/);
const bundle = await read(`dist/${hacs.filename}`);
assert.match(bundle, /customElements.define\("trvzb-control-card"/);
assert.ok(
  bundle.includes(`version: "${pkg.version}"`),
  "Bundle version differs from package.json",
);
const map = JSON.parse(await read(`dist/${hacs.filename}.map`));
assert.ok(
  map.sources.every(
    (source) => !source.startsWith("/") && !/^[A-Z]:/i.test(source),
  ),
  "Source map includes absolute paths",
);
const readme = await read("README.md");
assert.ok(
  readme.includes(`/local/${hacs.filename}?v=${pkg.version}`),
  "Update manual-install resource version in README",
);
for (const path of [
  "docs/images/control-light.png",
  "docs/images/control-dark.png",
  "docs/images/schedule-editor.png",
  "docs/images/temperature-presets.png",
  `docs/releases/${pkg.version}.md`,
])
  await access(new URL(`../${path}`, import.meta.url));
const index = process.argv.indexOf("--tag");
if (index >= 0)
  assert.equal(
    process.argv[index + 1],
    `v${pkg.version}`,
    "Tag and package version must match",
  );
console.log(
  `Release ${pkg.version}: manifest, license, bundle, map, screenshots, notes, and README verified.`,
);
