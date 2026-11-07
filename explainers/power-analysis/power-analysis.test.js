import { test } from "node:test";
import assert from "node:assert/strict";
import { power, sampleSize, simulate } from "./power-analysis.js";
import { mulberry } from "../../shared/random.js";

test("the textbook case: a 10% → 12% conversion lift needs about 3,800 users per group for 80% power", () => {
  const n = sampleSize({ p: 0.10, lift: 0.02, power: 0.8, alpha: 0.05 });
  assert.ok(n > 3700 && n < 3900, `${n}`);
  assert.ok(Math.abs(power({ p: 0.10, lift: 0.02, n, alpha: 0.05 }) - 0.8) < 0.01);
});

test("halving the lift you want to detect needs about four times the users", () => {
  const r = sampleSize({ p: 0.1, lift: 0.01 }) / sampleSize({ p: 0.1, lift: 0.02 }); assert.ok(r > 3.7 && r < 4.1, `${r}`);
});

test("simulated experiments agree, and small ones that do win overstate the lift", () => {
  const big = simulate({ p: 0.1, lift: 0.02, n: 3841, runs: 2000, rnd: mulberry(1) }), small = simulate({ p: 0.1, lift: 0.02, n: 1000, runs: 2000, rnd: mulberry(2) });
  assert.ok(Math.abs(big.detected - 0.8) < 0.03, `${big.detected}`); assert.ok(Math.abs(small.detected - power({ p: 0.1, lift: 0.02, n: 1000 })) < 0.04, `${small.detected}`);
  assert.ok(small.liftWhenSignificant > 0.03, `significant small tests report ${small.liftWhenSignificant}, truth 0.02`);
});
