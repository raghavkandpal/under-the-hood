// Scaffold a new explainer: page, logic module, test, and catalog entry.
//   npm run new -- <id> "<Title>" <area> <level>
// e.g. npm run new -- bloom-filters "Bloom filters" algorithms intro
// Refuses to touch any file that already exists.
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { AREAS, LEVELS, CATALOG } from "../catalog.js";

const [id, title, area = "algorithms", level = "core"] = process.argv.slice(2);
const fail = msg => { console.error("✗ " + msg); process.exit(1); };
if (!id || !title) fail('usage: npm run new -- <id> "<Title>" <area> <level>');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail("id must be lowercase words joined by hyphens");
if (!AREAS.some(a => a.id === area)) fail(`area must be one of: ${AREAS.map(a => a.id).join(", ")}`);
if (!(level in LEVELS)) fail(`level must be one of: ${Object.keys(LEVELS).join(", ")}`);
if (CATALOG.some(e => e.id === id)) fail(`catalog already has "${id}"`);
const files = { page: `${id}.html`, lib: `lib/${id}.js`, test: `tests/${id}.test.js` };
for (const f of Object.values(files)) if (existsSync(f)) fail(`${f} already exists, not overwriting`);

const fn = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
writeFileSync(files.lib, `// ${title}: the logic, with no DOM, so it can be tested in Node.

/** Replace with the real model. Keep it pure: inputs in, plain data out. */
export function ${fn}(n) {
  return { n, steps: n };
}
`);
writeFileSync(files.test, `import { test } from "node:test";
import assert from "node:assert/strict";
import { ${fn} } from "../lib/${id}.js";

test("${title}: replace with real checks", () => {
  assert.equal(${fn}(3).steps, 3);
});
`);
writeFileSync(files.page, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="style.css">
<style>
  /* Page-specific styles only. Shared: .row .tabs .stats .stat .panel .controls .status .scroll-x (style.css) */
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p class="lede">One or two sentences: the everyday problem, and the idea that solves it.</p>

  <div class="panel">
    <div class="row"><div class="tabs" id="mode"></div>
      <label class="inline">n <input type="range" id="n" min="1" max="50" value="10"> <b id="nv"></b></label></div>
    <div class="stats" id="stats"></div>
  </div>

  <h2>How it works</h2>
  <p><b>First idea.</b> Explain what the reader just saw.</p>
  <p class="status">Where it's used in the real world, and links to related explainers.</p>
</main>
<script type="module">
import { chrome, $, statTile, tabs } from "./common.js";
import { ${fn} } from "./lib/${id}.js";
chrome();

let mode = "a";
tabs($("#mode"), { a: "Option A", b: "Option B" }, mode, k => { mode = k; render(); });
function render() {
  const n = +$("#n").value, r = ${fn}(n);
  $("#nv").textContent = n;
  $("#stats").innerHTML = [[r.steps, "steps"], [mode, "mode"]].map(statTile).join("");
}
$("#n").oninput = render;
render();
</script>
</body>
</html>
`);
const cat = readFileSync("catalog.js", "utf8"), start = cat.indexOf("export const CATALOG = ["), end = cat.indexOf("\n];", start);
const entry = `  { id: "${id}", title: ${JSON.stringify(title)}, area: "${area}", level: "${level}", tags: [],\n    blurb: "TODO: one sentence for the home page card.", prereqs: [] },`;
writeFileSync("catalog.js", cat.slice(0, end) + "\n" + entry + cat.slice(end));
console.log(`✓ created ${Object.values(files).join(", ")} and a catalog entry.\n  Next: write lib/${id}.js + its test, fill in the page, then tags/blurb/prereqs in catalog.js.`);
