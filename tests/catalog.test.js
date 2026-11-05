import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { CATALOG, AREAS, LEVELS, search } from "../catalog.js";

const root = new URL("..", import.meta.url);
const pages = readdirSync(root).filter(f => f.endsWith(".html") && f !== "index.html").map(f => f.replace(".html", ""));

test("every catalog entry has a page and valid fields", () => {
  const ids = new Set();
  for (const c of CATALOG) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.ok(pages.includes(c.id), `${c.id}.html missing`);
    assert.ok(AREAS.some(a => a.id === c.area), `${c.id}: bad area`);
    assert.ok(LEVELS[c.level], `${c.id}: bad level`);
    for (const p of c.prereqs) assert.ok(CATALOG.some(x => x.id === p), `${c.id}: unknown prereq ${p}`);
  }
});

test("every page is in the catalog and calls chrome()", () => {
  for (const p of pages) {
    assert.ok(CATALOG.some(c => c.id === p), `${p}.html not in catalog`);
    const html = readFileSync(new URL(`${p}.html`, root), "utf8");
    assert.match(html, /chrome\(\)/, `${p}.html doesn't call chrome()`);
    assert.match(html, /<title>[^<]{3,40}<\/title>/, `${p}.html title`);
  }
});

test("prerequisite graph has no cycles", () => {
  const state = new Map();
  const visit = id => {
    if (state.get(id) === 1) throw new Error(`cycle through ${id}`);
    if (state.get(id) === 2) return;
    state.set(id, 1); CATALOG.find(c => c.id === id).prereqs.forEach(visit); state.set(id, 2);
  };
  CATALOG.forEach(c => visit(c.id));
});

test("search ranks title matches first and requires all terms", () => {
  assert.equal(search("raft")[0].id, "raft");
  assert.equal(search("hash")[0].id, "hashtable");
  assert.deepEqual(search("raft huffman"), []);
});
