import { test } from "node:test";
import assert from "node:assert/strict";
import { Heap, workload, STRATEGIES } from "./alloc.js";

const invariant = h => { let at = 0; for (const b of h.blocks) { assert.equal(b.start, at); assert.ok(b.size > 0); at += b.size; } assert.equal(at, h.size); };

test("blocks always tile the heap exactly, under every strategy", () => {
  for (const s of Object.keys(STRATEGIES)) for (const co of [true, false]) { const w = workload(s, { seed: 3, coalesce: co }); invariant(w.heap); }
});

test("strategies pick different holes", () => {
  const mk = s => { const h = new Heap(40, s); const a = h.malloc(10), b = h.malloc(4), c = h.malloc(6); h.malloc(20); h.free(a); h.free(c); return h; };
  // holes: [0..10) size 10 and [14..20) size 6
  const f = mk("first"), id1 = f.malloc(5); assert.equal(f.blocks.find(b => b.id === id1).start, 0);
  const b = mk("best"), id2 = b.malloc(5); assert.equal(b.blocks.find(x => x.id === id2).start, 14);
});

test("coalescing merges neighbours; without it free space shatters", () => {
  const h = new Heap(30), ids = [h.malloc(10), h.malloc(10), h.malloc(10)]; ids.forEach(i => h.free(i));
  assert.equal(h.blocks.length, 1);
  const n = new Heap(30, "first", { coalesce: false }), j = [n.malloc(10), n.malloc(10), n.malloc(10)]; j.forEach(i => n.free(i));
  assert.equal(n.blocks.length, 3); assert.equal(n.malloc(15), null);
});

test("fragmentation: enough total free memory, but no single hole big enough", () => {
  const h = new Heap(40), ids = []; for (let i = 0; i < 8; i++) ids.push(h.malloc(5));
  for (let i = 0; i < 8; i += 2) h.free(ids[i]);
  const s = h.stats(); assert.equal(s.totalFree, 20); assert.equal(s.largest, 5); assert.equal(h.malloc(10), null);
});
