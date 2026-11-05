import { test } from "node:test";
import assert from "node:assert/strict";
import { build, layerIds, diskUsage, imageSize, runWithLimit, FILES, DOCKERFILES } from "../lib/containers.js";

const edit = (path, text) => ({ ...FILES, [path]: text });
const rebuildAfter = (order, files) => { const first = build(DOCKERFILES[order], FILES); return build(DOCKERFILES[order], files, first.cache); };

test("an unchanged rebuild is fully cached", () => {
  for (const o of ["good", "bad"]) { const r = rebuildAfter(o, FILES); assert.ok(r.layers.every(l => l.cached)); assert.equal(r.time, 0); }
});

test("editing source code: bad order reinstalls dependencies, good order doesn't", () => {
  const files = edit("src/server.js", "app.listen(8080)");
  const bad = rebuildAfter("bad", files), good = rebuildAfter("good", files);
  assert.ok(!bad.layers.find(l => l.arg === "npm ci").cached); assert.ok(bad.time > 50);
  assert.ok(good.layers.find(l => l.arg === "npm ci").cached); assert.ok(good.time < 15);
});

test("changing dependencies rebuilds from the first COPY that sees package.json", () => {
  const r = rebuildAfter("good", edit("package.json", '{ "dependencies": { "express": "^5", "zod": "^4" } }'));
  assert.deepEqual(r.layers.map(l => l.cached), [true, true, false, false, false, false]);
});

test("a layer's ID depends on everything above it", () => {
  const a = layerIds(DOCKERFILES.good, FILES), b = layerIds([{ ...DOCKERFILES.good[0], arg: "node:20-slim" }, ...DOCKERFILES.good.slice(1)], FILES);
  assert.ok(a.every((id, i) => id !== b[i]));
});

test("images that share a base store it once", () => {
  const app = build(DOCKERFILES.good, FILES), other = build([DOCKERFILES.good[0], { op: "RUN", arg: "echo hi", size: 1 }], FILES);
  assert.equal(diskUsage([app, other]), imageSize(app) + 1);
});

test("the memory limit kills a process that goes over", () => {
  assert.deepEqual(runWithLimit([100, 200, 300], 250), { killed: true, at: 2 }); assert.deepEqual(runWithLimit([100], 250), { killed: false });
});
