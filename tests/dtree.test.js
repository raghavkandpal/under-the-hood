import { test } from "node:test";
import assert from "node:assert/strict";
import { gini, bestSplit, build, accuracy, nodes } from "../lib/dtree.js";
import { makeDataset } from "../lib/datasets.js";

test("gini", () => { assert.equal(gini(5, 10), 0.5); assert.equal(gini(0, 7), 0); assert.equal(gini(0, 0), 0); });

test("finds the obvious split", () => {
  const pts = [[-2, 0, -1], [-1, 5, -1], [1, -3, 1], [2, 1, 1]].map(([a, b, y]) => ({ x: [a, b], y }));
  const s = bestSplit(pts);
  assert.equal(s.f, 0); assert.equal(s.t, 0); assert.equal(s.score, 0);
});

test("deeper trees fit training data better; unlimited depth memorises", () => {
  const d = makeDataset("circles", { n: 160, seed: 3, noise: 0.15 });
  let prev = 0;
  for (const depth of [1, 2, 4, 8]) { const a = accuracy(build(d, { maxDepth: depth }), d); assert.ok(a >= prev - 1e-9); prev = a; }
  assert.equal(accuracy(build(d, { maxDepth: 50 }), d), 1);
});

test("minLeaf is respected and the tree stays binary", () => {
  const d = makeDataset("xor", { n: 160, seed: 1 });
  const t = build(d, { maxDepth: 10, minLeaf: 8 });
  for (const n of nodes(t)) { if (!n.left) assert.ok(n.n >= 8); else assert.ok(n.right); }
});

test("greedy splitting is myopic on XOR: shallow trees fail, deeper ones recover", () => {
  // No single axis split reduces Gini on XOR, so the greedy root split is near-useless.
  const train = makeDataset("xor", { n: 200, seed: 1, noise: 0.1 }), test = makeDataset("xor", { n: 400, seed: 2, noise: 0.1 });
  assert.ok(build(train, { maxDepth: 1 }).gain < 0.05);
  assert.ok(accuracy(build(train, { maxDepth: 3 }), test) < 0.65);
  assert.ok(accuracy(build(train, { maxDepth: 8 }), test) > 0.85);
});

test("generalises on blobs with a shallow tree", () => {
  const train = makeDataset("blobs", { n: 200, seed: 1 }), test = makeDataset("blobs", { n: 400, seed: 2 });
  assert.ok(accuracy(build(train, { maxDepth: 2 }), test) > 0.85);
});
