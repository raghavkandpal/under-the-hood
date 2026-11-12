import { test } from "node:test";
import assert from "node:assert/strict";
import { lanes, sumPlan, laneSum, scalarSum, f32add, intAdd, data, compareSums, maskedSum, carried, DEFAULTS } from "./simd.js";
import { mulberry } from "../../shared/random.js";

const D = DEFAULTS;

test("lanes = register bits / element bits", () => {
  assert.equal(lanes(128, 32), 4); assert.equal(lanes(128, 64), 2); assert.equal(lanes(128, 8), 16); assert.equal(lanes(256, 32), 8);
  assert.equal(lanes(D.registerBits, D.elementBits), 8, "the page opens on 8 lanes");
});

test("1,003 values on 8 lanes: 125 vector adds, 3 tail, 7 combining, 135 instead of 1,003", () => {
  const p = sumPlan(D.n, lanes(D.registerBits, D.elementBits));
  assert.deepEqual([p.vectorAdds, p.tailAdds, p.combineAdds, p.total, p.scalar], [125, 3, 7, 135, 1003]);
});

test("every reachable lane count: totals fall to 32 lanes (73), then rise at 64 (121), always below 1,003", () => {
  assert.deepEqual([2, 4, 8, 16, 32, 64].map(L => sumPlan(D.n, L).total), [503, 256, 135, 88, 73, 121]);
  for (const L of [2, 4, 8, 16, 32, 64]) assert.ok(sumPlan(D.n, L).total < D.n);
});

test("float32 lane sums: a hand-checked case where order changes the answer", () => {
  const xs = [16777216, 1, 1, 1];   // 2^24: adding 1 to it rounds back to 2^24 in float32
  assert.equal(scalarSum(xs, f32add), 16777216);           // ((2^24 + 1) + 1) + 1, each step rounds down
  assert.equal(laneSum(xs, 2, f32add), 16777218);          // lanes: 2^24 + 1 = 2^24, and 1 + 1 = 2; then 2^24 + 2
});

test("the page's opening numbers: seed 1, 8 lanes", () => {
  const f = compareSums(D.n, 8, D.seed, "f32"), i = compareSums(D.n, 8, D.seed, "int");
  assert.equal(f.scalar, -96515.3671875);   // shown as -96,515.367
  assert.equal(f.lanes, -96516.078125);     // shown as -96,516.078
  assert.equal(Math.abs(f.scalar - f.lanes), 0.7109375);   // shown as 0.711
  assert.deepEqual([i.scalar, i.lanes, i.same], [-17515, -17515, true]);
});

test("integer sums are identical at every reachable lane count and seed", () => {
  for (const L of [2, 4, 8, 16, 32, 64]) for (let seed = 1; seed <= 5; seed++) assert.equal(compareSums(D.n, L, seed, "int").same, true, `${L} lanes seed ${seed}`);
  const xs = data(D.n, D.seed, "int");
  assert.equal(laneSum(xs, 8, intAdd), xs.reduce((a, b) => a + b, 0), "matches plain addition (no wrap-around at this size)");
});

test("float sums at every state Sum can show (4, 8, 16 lanes x seeds 1-5): all differ except 4 lanes, seed 4", () => {
  const same = [];
  for (const L of [4, 8, 16]) for (let seed = 1; seed <= 5; seed++) if (compareSums(D.n, L, seed, "f32").same) same.push([L, seed]);
  assert.deepEqual(same, [[4, 4]]);
});

test("masked sum equals the branchy sum exactly, for sorted and random data", () => {
  for (const seed of [1, 2, 3, 4, 5]) for (const sorted of [true, false]) {
    const rnd = mulberry(seed), xs = Array.from({ length: D.bytes }, () => Math.floor(rnd() * 256));
    // sorting changes the order, not the set of bytes, so one reference covers both
    const reference = xs.filter(x => x >= 128).reduce((a, b) => a + b, 0), r = maskedSum(D.bytes, seed, sorted);
    assert.equal(r.masked, reference); assert.equal(r.branchy, reference);
  }
});

test("masked cycles do not depend on the data; branchy cycles do", () => {
  const s = maskedSum(D.bytes, D.seed, true), r = maskedSum(D.bytes, D.seed, false);
  assert.equal(s.vectorCycles, r.vectorCycles);
  assert.equal(s.vectorCycles, 1507, "500 vector iterations of 3 instructions, plus folding 8 lanes");
  assert.ok(s.misses < D.bytes * 0.005, `${s.misses} misses on sorted data`);
  assert.ok(Math.abs(r.misses / D.bytes - 0.5) < 0.04, `${r.misses} misses on random data`);
  assert.equal(r.scalarCycles, D.bytes + r.misses * 15, "1 cycle per element plus 15 per wrong guess");
  assert.equal(s.maskedMisses, 0); assert.equal(r.maskedMisses, 0);
  assert.ok(r.scalarCycles > s.scalarCycles);
  assert.ok(r.scalarCycles > r.vectorCycles && s.scalarCycles > s.vectorCycles);
});

test("a carried dependency: hand-checked case, and the independent loop matches", () => {
  const a = [1, 0, 0, 0], b = [1, 1, 1, 1];
  const dep = carried(a, b, 3, true);
  assert.deepEqual(dep.scalar, [1, 2, 3, 4]); assert.deepEqual(dep.vector, [1, 2, 1, 1]); assert.equal(dep.same, false);
  const ind = carried(a, b, 3, false);
  assert.deepEqual(ind.scalar, [1, 1, 1, 1]); assert.equal(ind.same, true);
});

test("the page's Carry inputs (ones, b = i%3+1, 4 at a time): hand-checked rows", () => {
  const a = Array(12).fill(1), b = Array.from({ length: 12 }, (_, i) => i % 3 + 1);
  const d = carried(a, b, 4, true);
  assert.deepEqual(d.scalar, [1, 3, 6, 7, 9, 12, 13, 15, 18, 19, 21, 24]);
  assert.deepEqual(d.vector, [1, 3, 4, 2, 3, 6, 2, 3, 4, 5, 3, 4]);   // each block's first cell sees the previous block's result
  assert.equal(d.same, false);
  const ind = carried(a, b, 4, false);
  assert.deepEqual(ind.vector, ind.scalar); assert.equal(ind.same, true);
});

test("one lane is the scalar loop; the dependent result changes with the vector length", () => {
  const rnd = mulberry(7), a = Array.from({ length: 32 }, () => 1 + Math.floor(rnd() * 9)), b = Array.from({ length: 32 }, () => 1 + Math.floor(rnd() * 9));
  let total = a[0]; const prefix = [a[0]]; for (let i = 1; i < 32; i++) prefix.push(total += b[i]);
  assert.deepEqual(carried(a, b, 1, true).vector, prefix); assert.equal(carried(a, b, 1, true).same, true);
  const vectors = [2, 4, 8].map(L => JSON.stringify(carried(a, b, L, true).vector));
  assert.equal(new Set(vectors).size, 3, "each L gives its own answer");
  for (const L of [2, 4, 8]) {
    const d = carried(a, b, L, true);
    assert.deepEqual(d.scalar, prefix); assert.equal(d.same, false, `${L} lanes`);
    assert.equal(carried(a, b, L, false).same, true);
  }
});
