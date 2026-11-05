import { test } from "node:test";
import assert from "node:assert/strict";
import { build, proof, verify, diff } from "./merkle.js";

const blocks = n => Array.from({ length: n }, (_, i) => `block ${i}`);

test("proofs verify for every leaf at many sizes, and are log-sized", () => {
  for (const n of [1, 2, 3, 5, 8, 13, 16, 33]) {
    const t = build(blocks(n));
    for (let i = 0; i < n; i++) {
      const p = proof(t, i);
      assert.ok(verify(`block ${i}`, p, t.root), `n=${n} i=${i}`);
      assert.ok(p.length <= Math.ceil(Math.log2(Math.max(2, n))));
    }
  }
});

test("tampered data or wrong position fails", () => {
  const t = build(blocks(8));
  assert.ok(!verify("block 3!", proof(t, 3), t.root));
  assert.ok(!verify("block 3", proof(t, 4), t.root));
});

test("changing one block changes the root; diff finds it touching few nodes", () => {
  const a = blocks(64), b = a.slice(); b[37] = "tampered";
  const ta = build(a), tb = build(b);
  assert.notEqual(ta.root, tb.root);
  const d = diff(ta, tb);
  assert.deepEqual(d.leaves, [37]);
  assert.ok(d.visited.length <= 2 * 7 + 1, `visited ${d.visited.length}`);
});
