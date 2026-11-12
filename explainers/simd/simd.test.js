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
  assert.equal(125 * 8 + 3, 1003, "every value is added exactly once");
});

test("wider registers need fewer instructions, for any element size", () => {
  const totals = [2, 4, 8, 16].map(L => sumPlan(D.n, L).total);
  assert.deepEqual([...totals].sort((a, b) => b - a), totals);
  for (const L of [2, 4, 8, 16]) assert.ok(totals[0] <= D.n && sumPlan(D.n, L).total < D.n);
});

test("float32 lane sums: a hand-checked case where order changes the answer", () => {
  const xs = [16777216, 1, 1, 1];   // 2^24: adding 1 to it rounds back to 2^24 in float32
  assert.equal(scalarSum(xs, f32add), 16777216);           // ((2^24 + 1) + 1) + 1, each step rounds down
  assert.equal(laneSum(xs, 2, f32add), 16777218);          // lanes: 2^24 + 1 = 2^24, and 1 + 1 = 2; then 2^24 + 2
});

test("the page's default seed: float sums differ from the scalar sum, integer sums match", () => {
  const f = compareSums(D.n, 8, D.seed, "f32"), i = compareSums(D.n, 8, D.seed, "int");
  assert.equal(f.same, false); assert.notEqual(f.scalar, f.lanes);
  assert.equal(i.same, true);
  assert.equal(Math.fround(f.scalar), f.scalar, "both are float32 values");
});

test("across seeds and lane counts, float sums differ and integer sums never do", () => {
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(compareSums(D.n, 8, seed, "int").same, true, `int seed ${seed}`);
    const xs = data(D.n, seed, "int"), exact = xs.reduce((a, b) => a + b, 0);   // brute-force reference, no wrap-around at this size
    assert.equal(laneSum(xs, 8, intAdd), exact);
  }
  const differing = Array.from({ length: 20 }, (_, s) => compareSums(D.n, 8, s + 1, "f32").same).filter(same => !same).length;
  assert.ok(differing >= 18, `${differing} of 20 seeds differ`);
  for (const L of [2, 4, 16]) assert.equal(compareSums(D.n, L, D.seed, "f32").same, false, `${L} lanes`);
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
  assert.equal(s.vectorCycles, 3 * 500 + 7, "500 vector iterations of 3 instructions, plus folding 8 lanes");
  assert.ok(s.misses < D.bytes * 0.005, `${s.misses} misses on sorted data`);
  assert.ok(Math.abs(r.misses / D.bytes - 0.5) < 0.04, `${r.misses} misses on random data`);
  assert.equal(r.scalarCycles, D.bytes + r.misses * 15);
  assert.ok(r.scalarCycles > 5 * s.scalarCycles / 2 && r.scalarCycles > s.scalarCycles);
  assert.ok(r.scalarCycles > r.vectorCycles && s.scalarCycles > s.vectorCycles);
});

test("a carried dependency: hand-checked case, and the independent loop matches", () => {
  const a = [1, 0, 0, 0], b = [1, 1, 1, 1];
  const dep = carried(a, b, 3, true);
  assert.deepEqual(dep.scalar, [1, 2, 3, 4]); assert.deepEqual(dep.vector, [1, 2, 1, 1]); assert.equal(dep.same, false);
  const ind = carried(a, b, 3, false);
  assert.deepEqual(ind.scalar, [1, 1, 1, 1]); assert.equal(ind.same, true);
});

test("dependent scalar result is a running sum; vectors of any width get it wrong, independent loops never", () => {
  const rnd = mulberry(7), a = Array.from({ length: 32 }, () => 1 + Math.floor(rnd() * 9)), b = Array.from({ length: 32 }, () => 1 + Math.floor(rnd() * 9));
  let run = a[0]; const prefix = [a[0]]; for (let i = 1; i < 32; i++) prefix.push(run += b[i]);
  for (const L of [2, 4, 8]) {
    const d = carried(a, b, L, true);
    assert.deepEqual(d.scalar, prefix); assert.equal(d.same, false, `${L} lanes`);
    assert.equal(carried(a, b, L, false).same, true);
  }
});
