import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, makeTrace, POLICIES } from "./eviction.js";

test("optimal is never beaten", () => {
  for (const kind of ["zipf", "loop", "scan", "shift"]) {
    const t = makeTrace(kind, 600, 5, 2), opt = simulate(t, 5, "opt").hits;
    for (const p of Object.keys(POLICIES)) assert.ok(simulate(t, 5, p).hits <= opt, `${kind}/${p}`);
  }
});

test("a loop one bigger than the cache gives LRU and FIFO zero hits", () => {
  const t = makeTrace("loop", 200, 5);
  assert.equal(simulate(t, 5, "lru").hits, 0); assert.equal(simulate(t, 5, "fifo").hits, 0);
  assert.ok(simulate(t, 5, "random").hits > 0);
});

test("LFU survives scans better than LRU; LRU adapts to shifts better than LFU", () => {
  const scan = makeTrace("scan", 1200, 5, 3), shift = makeTrace("shift", 1200, 5, 3);
  assert.ok(simulate(scan, 5, "lfu").rate > simulate(scan, 5, "lru").rate);
  assert.ok(simulate(shift, 5, "lru").rate > simulate(shift, 5, "lfu").rate);
});

test("cache never exceeds its size", () => {
  for (const s of simulate(makeTrace("zipf", 300, 4), 4, "lru").steps) assert.ok(s.contents.length <= 4);
});
