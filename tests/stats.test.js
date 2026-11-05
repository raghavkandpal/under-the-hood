import { test } from "node:test";
import assert from "node:assert/strict";
import { DISTS, mean, sampleSd, ci95, histogram } from "../lib/stats.js";
import { mulberry } from "../lib/autograd.js";

test("stated means and SDs match simulation", () => {
  for (const [k, d] of Object.entries(DISTS)) {
    const r = mulberry(k.length * 7), xs = Array.from({ length: 200000 }, () => d.draw(r));
    assert.ok(Math.abs(mean(xs) - d.mean) < 0.03 * Math.max(1, d.sd), `${k} mean ${mean(xs)}`);
    assert.ok(Math.abs(sampleSd(xs) - d.sd) / d.sd < 0.03, `${k} sd ${sampleSd(xs)}`);
  }
});

test("sample means shrink like sd/√n", () => {
  const d = DISTS.skewed, r = mulberry(5), n = 25;
  const means = Array.from({ length: 20000 }, () => mean(Array.from({ length: n }, () => d.draw(r))));
  assert.ok(Math.abs(sampleSd(means) - d.sd / Math.sqrt(n)) / (d.sd / Math.sqrt(n)) < 0.05);
});

test("95% t-intervals cover the true mean about 95% of the time", () => {
  const d = DISTS.uniform, r = mulberry(9);
  let hit = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const c = ci95(Array.from({ length: 10 }, () => d.draw(r))); if (c.lo <= d.mean && d.mean <= c.hi) hit++; }
  assert.ok(Math.abs(hit / N - 0.95) < 0.01, `coverage ${hit / N}`);
});

test("histogram counts everything in range", () => {
  const h = histogram([0, 0.5, 1, 9.99, 10, -1], 0, 10, 10);
  assert.equal(h.counts.reduce((a, b) => a + b), 4);
});
