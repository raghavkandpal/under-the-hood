import { test } from "node:test";
import assert from "node:assert/strict";
import { SkipList } from "./skiplist.js";
import { mulberry } from "../../shared/random.js";

test("behaves like a sorted set", () => {
  const s = new SkipList({ seed: 2 }), ref = new Set(), r = mulberry(7);
  for (let i = 0; i < 800; i++) { const k = Math.floor(r() * 300); if (r() < 0.7) { assert.equal(s.insert(k), !ref.has(k)); ref.add(k); } else { assert.equal(s.remove(k), ref.has(k)); ref.delete(k); } }
  assert.deepEqual(s.nodes().map(n => n.key), [...ref].sort((a, b) => a - b));
  for (let k = 0; k < 300; k++) assert.equal(s.search(k).found, ref.has(k));
});

test("search cost grows like log n, far below n", () => {
  const avgSteps = n => { const s = new SkipList({ seed: 3, maxLevel: 16 }); for (let i = 0; i < n; i++) s.insert(i * 2); let t = 0; for (let q = 0; q < 200; q++) t += s.search(Math.floor(q * n / 100)).steps; return t / 200; };
  const a = avgSteps(100), b = avgSteps(10000);
  assert.ok(b < a * 4, `${a} → ${b}`); assert.ok(b < 80);
});

test("about half the nodes reach level 2 with p = ½", () => {
  const s = new SkipList({ seed: 5 }); for (let i = 0; i < 4000; i++) s.insert(i);
  const share = s.nodes().filter(n => n.height >= 2).length / 4000; assert.ok(Math.abs(share - 0.5) < 0.04, String(share));
});
