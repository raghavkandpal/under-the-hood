import { test } from "node:test";
import assert from "node:assert/strict";
import { BTree } from "./btree.js";
import { mulberry } from "../../shared/random.js";

test("invariants hold under random inserts for several orders", () => {
  for (const max of [2, 3, 4, 5, 8]) {
    const t = new BTree(max), r = mulberry(max), seen = new Set();
    for (let i = 0; i < 400; i++) { const k = Math.floor(r() * 1000); t.insert(k); seen.add(k); t.check(); }
    assert.deepEqual(t.inorder(), [...seen].sort((a, b) => a - b));
    for (const k of seen) assert.ok(t.search(k).found);
    assert.ok(!t.search(1001).found);
  }
});

test("sequential inserts stay balanced and shallow", () => {
  const t = new BTree(4);
  for (let i = 1; i <= 1000; i++) t.insert(i);
  t.check();
  assert.ok(t.height() <= 6, `height ${t.height()}`);
  for (const k of [1, 333, 777, 1000, 5000]) assert.ok(t.search(k).visited.length <= t.height());
  assert.equal(t.search(5000).visited.length, t.height(), "a miss always reaches a leaf");
});

test("bigger nodes => shorter tree", () => {
  const h = max => { const t = new BTree(max); for (let i = 0; i < 2000; i++) t.insert(i * 7 % 2003); return t.height(); };
  assert.ok(h(32) < h(3));
});

test("duplicate insert is a no-op", () => {
  const t = new BTree(3); t.insert(5); assert.equal(t.insert(5).inserted, false); assert.equal(t.size, 1);
});
