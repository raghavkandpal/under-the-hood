import { test } from "node:test";
import assert from "node:assert/strict";
import { interference, maxPressure, colour, valid, ORDERS } from "./coloring.js";

const ranges = { a: [0, 4], b: [1, 3], c: [2, 6], d: [4, 7], e: [5, 8] };

test("overlapping live ranges interfere, touching ones don't", () => {
  const g = interference(ranges);
  assert.ok(g.a.has("b") && g.a.has("c")); assert.ok(!g.a.has("d")); // a ends at 4, d starts at 4
  assert.equal(maxPressure(ranges), 3);
});

test("every order gives a valid colouring", () => {
  const g = interference(ranges);
  for (const order of Object.keys(ORDERS)) { const r = colour(g, { order, ranges }); assert.ok(valid(g, r.col), order); assert.equal(r.spilled.length, 0); }
});

test("linear scan is optimal on live ranges", () => {
  for (let seed = 1; seed < 30; seed++) {
    let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const R = {}; for (let i = 0; i < 10; i++) { const st = Math.floor(rnd() * 20); R["v" + i] = [st, st + 1 + Math.floor(rnd() * 8)]; }
    assert.equal(colour(interference(R), { order: "start", ranges: R }).used, maxPressure(R));
  }
});

test("too few registers forces spills", () => {
  const g = interference(ranges), r = colour(g, { order: "start", ranges, k: 2 });
  assert.ok(r.spilled.length > 0); assert.ok(valid(g, r.col)); assert.ok(r.used <= 2);
});

test("a bad order wastes colours on a crown graph", () => {
  // crown graph: ai–bj for i≠j. Bipartite (2 colours) but alphabetical-interleaved greedy needs n.
  const adj = {}; const n = 4; for (let i = 0; i < n; i++) { adj["a" + i] = new Set(); adj["b" + i] = new Set(); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) { adj["a" + i].add("b" + j); adj["b" + j].add("a" + i); }
  const inter = Object.fromEntries(Array.from({ length: n }, (_, i) => [["a" + i, adj["a" + i]], ["b" + i, adj["b" + i]]]).flat());
  // order a0,b0,a1,b1,…: force by passing ranges with starts in that order
  const R = Object.fromEntries(Object.keys(inter).map((k, i) => [k, [i, i + 1]]));
  assert.equal(colour(inter, { order: "start", ranges: R }).used, n);
  assert.equal(colour(inter, { order: "dsatur" }).used, 2);
});
