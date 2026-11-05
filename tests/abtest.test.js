import { test } from "node:test";
import assert from "node:assert/strict";
import { erf, normCdf, normInv, zTest, sampleSize, peekingRates } from "../lib/abtest.js";

test("normal helpers", () => {
  assert.ok(Math.abs(erf(1) - 0.8427007929) < 1e-6);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normInv(0.975) - 1.959964) < 1e-4);
});

test("z test on a known example", () => {
  // 200/1000 vs 250/1000: z ≈ 2.68, p ≈ 0.0073
  const r = zTest(200, 1000, 250, 1000);
  assert.ok(Math.abs(r.z - 2.68) < 0.02 && Math.abs(r.p - 0.0073) < 0.001, JSON.stringify(r));
});

test("sample size matches the standard formula ballpark", () => {
  // 10% → 12% at 80% power, α=0.05: ~3,840 per arm
  const n = sampleSize(0.10, 0.02);
  assert.ok(n > 3700 && n < 4000, String(n));
  assert.ok(sampleSize(0.10, 0.01) > 3.5 * n, "halving the effect ~quadruples n");
});

test("A/A tests: fixed horizon ≈ 5% false positives, peeking inflates it", () => {
  const r = peekingRates({ pA: 0.1, pB: 0.1, n: 2000, every: 50, trials: 400 });
  assert.ok(r.fixed < 0.09, `fixed ${r.fixed}`);
  assert.ok(r.peeking > 0.15, `peeking ${r.peeking}`);
});
