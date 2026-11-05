import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, seqCost, indexCost, choosePlan, crossover, prices, histogram, estimateLess, actualLess } from "../lib/query-planner.js";
import { mulberry } from "../lib/autograd.js";

test("few matching rows: index; most rows: full scan", () => {
  assert.equal(choosePlan(100).plan, "index"); assert.equal(choosePlan(500_000).plan, "seq");
});

test("the crossover is a small percentage, and moves with storage speed and clustering", () => {
  const hdd = crossover(), ssd = crossover({ ...DEFAULTS, randomPage: 1.1 }), clustered = crossover(DEFAULTS, true);
  assert.ok(hdd > 0.001 && hdd < 0.05, `hdd ${hdd}`);
  assert.ok(ssd > hdd * 2, `ssd ${ssd}`);
  assert.ok(clustered > 0.3, `clustered ${clustered}`);
});

test("histograms estimate skewed data well", () => {
  const v = prices(50_000, mulberry(1)), h = histogram(v);
  for (const x of [10, 30, 100, 400]) assert.ok(Math.abs(estimateLess(h, x) - actualLess(v, x)) < 0.03, `x=${x}`);
});

test("stale statistics can pick a plan that's far worse in reality", () => {
  const rnd = mulberry(2), before = prices(50_000, rnd), after = prices(50_000, rnd, { sale: true }), stale = histogram(before);
  const x = 5, est = estimateLess(stale, x) * DEFAULTS.rows, real = actualLess(after, x) * DEFAULTS.rows;
  const chosen = choosePlan(est).plan, best = choosePlan(real).plan;
  assert.equal(chosen, "index"); assert.equal(best, "seq");
  assert.ok(indexCost(real) > seqCost() * 3, "the chosen plan costs several times the full scan");
});
