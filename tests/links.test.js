import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set(["node_modules", ".git", ".claude"]);
const walk = d => readdirSync(d).flatMap(f => (SKIP.has(f) ? [] : statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
// scripts/new.js is skipped: its page templates contain import lines for files it hasn't created yet
const files = walk(root).filter(f => /\.(html|js)$/.test(f) && !f.endsWith(join("scripts", "new.js")));

const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
const ATTR = /(?:href|src)="([^"#?:$`{}]+)["#?]/g; // relative links only; skips URLs, anchors and template expressions

/** Does a relative reference from `file` point at something that exists? Folder links need an index.html. */
const exists = (file, ref) => {
  const target = join(dirname(file), ref);
  if (ref.endsWith("/")) return existsSync(join(target, "index.html"));
  return existsSync(target);
};

test("every relative import resolves", () => {
  const broken = [];
  for (const f of files) for (const [, ref] of readFileSync(f, "utf8").matchAll(IMPORT)) if (!exists(f, ref)) broken.push(`${relative(root, f)} → ${ref}`);
  assert.deepEqual(broken, []);
});

test("every relative href and src in pages resolves", () => {
  const broken = []; let checked = 0;
  for (const f of files.filter(f => f.endsWith(".html"))) for (const [, ref] of readFileSync(f, "utf8").matchAll(ATTR)) { checked++; if (!exists(f, ref)) broken.push(`${relative(root, f)} → ${ref}`); }
  assert.deepEqual(broken, []); assert.ok(checked > 100, `only ${checked} links checked`);
});

test("pages don't use the old flat layout", () => {
  const old = [];
  for (const f of files.filter(f => f.endsWith(".html"))) for (const [, ref] of readFileSync(f, "utf8").matchAll(ATTR)) if (/^[a-z0-9-]+\.html$/.test(ref) && !f.endsWith(`${root}index.html`)) old.push(`${relative(root, f)} → ${ref}`);
  assert.deepEqual(old, []);
});
