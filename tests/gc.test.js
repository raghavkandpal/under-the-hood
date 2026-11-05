import { test } from "node:test";
import assert from "node:assert/strict";
import { Heap } from "../lib/gc.js";

function chainAndCycle(mode) {
  const h = new Heap(mode);
  const a = h.alloc("x"), b = h.alloc(), c = h.alloc();
  h.link(a, b); h.link(b, c);           // x → a → b → c
  const p = h.alloc("y"), q = h.alloc();
  h.link(p, q); h.link(q, p);           // y → p ⇄ q (cycle)
  return { h, a, b, c, p, q };
}

test("refcount frees a dropped chain immediately but leaks a cycle", () => {
  const { h, a, b, c, p, q } = chainAndCycle("refcount");
  h.setRoot("x", null);
  for (const id of [a, b, c]) assert.ok(!h.objs.has(id));
  h.setRoot("y", null);
  assert.ok(h.objs.has(p) && h.objs.has(q), "cycle survives");
  assert.deepEqual(h.garbage().sort(), [p, q].sort(), "but it's unreachable");
});

test("mark-and-sweep frees both, only when collect runs", () => {
  const { h, a, b, c, p, q } = chainAndCycle("marksweep");
  h.setRoot("x", null); h.setRoot("y", null);
  assert.equal(h.objs.size, 5, "nothing freed until a collection");
  const { swept } = h.collect();
  assert.deepEqual(swept.sort(), [a, b, c, p, q].sort());
  assert.equal(h.objs.size, 0);
});

test("reachable objects are never collected", () => {
  const { h, a, b, c } = chainAndCycle("marksweep");
  h.setRoot("y", null);
  h.collect();
  for (const id of [a, b, c]) assert.ok(h.objs.has(id));
  assert.equal(h.objs.get(b).rc, 1);
});

test("unlink in refcount mode cascades", () => {
  const { h, a, b, c } = chainAndCycle("refcount");
  h.unlink(a, b);
  assert.ok(!h.objs.has(b) && !h.objs.has(c) && h.objs.has(a));
});
