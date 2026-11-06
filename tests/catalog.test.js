import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { CATALOG, AREAS, LEVELS, PATHS, search, byId, topicOf, pathsWith } from "../catalog.js";

const root = new URL("..", import.meta.url);
const dir = new URL("explainers/", root);
const pages = readdirSync(dir).filter(d => existsSync(new URL(`${d}/index.html`, dir)));

test("every catalog entry has a page and valid fields", () => {
  const ids = new Set();
  for (const c of CATALOG) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.ok(pages.includes(c.id), `explainers/${c.id}/index.html missing`);
    assert.ok(AREAS.some(a => a.id === c.area), `${c.id}: bad area`);
    assert.ok(LEVELS[c.level], `${c.id}: bad level`);
    for (const p of c.prereqs) assert.ok(CATALOG.some(x => x.id === p), `${c.id}: unknown prereq ${p}`);
  }
});

test("every page is in the catalog and calls chrome()", () => {
  for (const p of pages) {
    assert.ok(CATALOG.some(c => c.id === p), `explainers/${p}/ not in catalog`);
    const html = readFileSync(new URL(`${p}/index.html`, dir), "utf8");
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

test("every explainer sits in a topic that belongs to its area", () => {
  for (const c of CATALOG) assert.ok(topicOf(c), `${c.id}: topic "${c.topic}" isn't one of ${c.area}'s topics`);
  for (const a of AREAS) {
    assert.ok(a.topics.length > 0, `${a.id} has no topics`);
    assert.equal(new Set(a.topics.map(t => t.id)).size, a.topics.length, `${a.id}: duplicate topic id`);
    for (const t of a.topics) assert.ok(CATALOG.some(c => c.area === a.id && c.topic === t.id), `${a.id}/${t.id} is empty`);
  }
});

test("learning paths use real explainers, once each, prerequisites first", () => {
  assert.equal(new Set(PATHS.map(p => p.id)).size, PATHS.length, "duplicate path id");
  for (const p of PATHS) {
    assert.ok(p.steps.length >= 3 && p.title && p.blurb, `${p.id}: too short or missing text`);
    p.steps.forEach((id, i) => {
      assert.ok(byId(id), `${p.id}: unknown ${id}`); assert.equal(p.steps.indexOf(id), i, `${p.id}: ${id} repeated`);
      for (const pre of byId(id).prereqs) assert.ok(!(p.steps.indexOf(pre) > i), `${p.id}: ${id} comes before its prerequisite ${pre}`);
    });
  }
  assert.ok(pathsWith("attention").some(p => p.id === "llms"));
});

test("search matches topic names", () => { assert.ok(search("storage engines").some(c => c.id === "lsm")); });

test("every learning path has an introduction for its page", () => {
  for (const p of PATHS) {
    assert.ok(p.intro && p.intro.length > 120, `${p.id}: intro missing or too short`);
    assert.ok(p.audience, `${p.id}: audience missing`);
    assert.ok(Array.isArray(p.outcomes) && p.outcomes.length >= 3, `${p.id}: needs 3+ outcomes`);
  }
});
