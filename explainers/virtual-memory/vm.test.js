import { test } from "node:test";
import assert from "node:assert/strict";
import { VM, faults } from "./vm.js";

test("translation keeps the offset and maps pages to frames", () => {
  const vm = new VM({ pageSize: 256, frames: 4 });
  const a = vm.translate(0x123); assert.equal(a.vpn, 1); assert.equal(a.offset, 0x23); assert.ok(a.fault);
  const b = vm.translate(0x1ff); assert.equal(b.frame, a.frame); assert.ok(!b.fault && b.tlbHit);
  assert.equal(b.paddr, b.frame * 256 + 0xff);
});

test("Belady's anomaly: FIFO gets MORE faults with more frames; LRU doesn't", () => {
  const refs = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
  assert.equal(faults(refs, 3, "fifo"), 9);
  assert.equal(faults(refs, 4, "fifo"), 10);
  assert.ok(faults(refs, 4, "lru") <= faults(refs, 3, "lru"));
});

test("optimal is never worse than LRU or FIFO", () => {
  let x = 5; const refs = Array.from({ length: 200 }, () => (x = (x * 1103515245 + 12345) % 2147483648) % 9);
  for (const f of [2, 3, 4, 6]) { const o = faults(refs, f, "opt"); assert.ok(o <= faults(refs, f, "lru") && o <= faults(refs, f, "fifo"), `frames ${f}`); }
});

test("thrashing: a loop one page bigger than memory faults every time under LRU", () => {
  const refs = Array.from({ length: 50 }, (_, i) => i % 5);
  assert.equal(faults(refs, 4, "lru"), 50);
  assert.equal(faults(refs, 5, "lru"), 5);
});
