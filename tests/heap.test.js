import { test } from "node:test";
import assert from "node:assert/strict";
import { Heap, heapify, topK } from "../lib/heap.js";
import { mulberry } from "../lib/autograd.js";

const rnd = mulberry(3), xs = Array.from({ length: 200 }, () => Math.floor(rnd() * 1000));

test("pops come out sorted and the heap property holds throughout", () => {
  const h = new Heap(); for (const x of xs) { h.push(x); assert.ok(h.valid()); }
  const out = []; while (h.size) { out.push(h.pop()); assert.ok(h.valid()); }
  assert.deepEqual(out, [...xs].sort((a, b) => a - b));
});

test("operations are logarithmic", () => {
  const h = new Heap(xs); h.compares = 0; h.push(-1); assert.ok(h.compares <= 8); // depth of 200 items ≈ 7.6
  h.compares = 0; h.pop(); assert.ok(h.compares <= 16);
});

test("heapify builds a valid heap in linear time", () => {
  const { a, swaps } = heapify(xs); const h = new Heap(); h.a = a; assert.ok(h.valid()); assert.ok(swaps < xs.length);
});

test("top-k from a stream", () => {
  const big = Array.from({ length: 10000 }, (_, i) => (i * 7919) % 10007), r = topK(big, 5);
  assert.deepEqual(r.top, [...big].sort((a, b) => b - a).slice(0, 5)); assert.ok(r.compares < 10000 * 4);
});
