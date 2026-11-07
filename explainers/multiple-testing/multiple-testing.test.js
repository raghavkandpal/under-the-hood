import { test } from "node:test";
import assert from "node:assert/strict";
import { pValue, decide, longRun, simulate, score } from "./multiple-testing.js";
import { mulberry } from "../../shared/random.js";

test("p-values: z = 1.96 is p = 0.05, z = 0 is p = 1", () => {
  assert.ok(Math.abs(pValue(1.96) - 0.05) < 1e-4); assert.ok(Math.abs(pValue(0) - 1) < 1e-6); assert.ok(Math.abs(pValue(-2.576) - 0.01) < 1e-4);
});

test("the three methods on the textbook example", () => {
  const ps = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205], n = m => decide(ps, m).filter(Boolean).length;
  assert.equal(n("none"), 5); assert.equal(n("bonferroni"), 1); assert.equal(n("bh"), 2);
  assert.deepEqual(decide([0.04, 0.01], "bh"), [true, true], "BH: once rank 2 passes, rank 1 passes too");
});

test("20 tests of nothing: about 64% of experiments find a false win (1 − 0.95²⁰)", () => {
  const r = longRun({ m: 20, realShare: 0, runs: 3000, rnd: mulberry(1) });
  assert.ok(Math.abs(r.none.fwer - (1 - 0.95 ** 20)) < 0.03, `${r.none.fwer}`);
  assert.ok(r.bonferroni.fwer <= 0.06 && r.bh.fwer <= 0.06, `${r.bonferroni.fwer} ${r.bh.fwer}`);
});

test("with some real effects, BH keeps false wins near 5% and finds more than Bonferroni", () => {
  const r = longRun({ m: 50, realShare: 0.2, runs: 1500, rnd: mulberry(2) });
  assert.ok(r.bh.fdr <= 0.05, `bh fdr ${r.bh.fdr}`); assert.ok(r.none.fdr > 0.1, `none fdr ${r.none.fdr}`);
  assert.ok(r.bh.power > r.bonferroni.power + 0.15, `${r.bh.power} vs ${r.bonferroni.power}`);
  assert.ok(r.none.power > 0.8, `a single real effect is found ${r.none.power} of the time`);
});

test("score counts true and false wins", () => {
  const tests = simulate({ m: 10, realShare: 0.3, rnd: mulberry(3) }), s = score(tests, tests.map(() => true));
  assert.deepEqual([s.wins, s.trueWins, s.falseWins, s.real, s.power], [10, 3, 7, 3, 1]);
});
