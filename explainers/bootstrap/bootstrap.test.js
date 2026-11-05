import { test } from "node:test";
import assert from "node:assert/strict";
import { mean, median, draw, resample, bootstrap, ci, coverage, POPS } from "./bootstrap.js";
import { mulberry } from "../../shared/random.js";

test("a resample has the same size, drawn from the original values, some repeated", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { out, counts } = resample(xs, mulberry(1));
  assert.equal(out.length, 10); assert.ok(out.every(v => xs.includes(v))); assert.equal(counts.reduce((a, b) => a + b), 10);
  assert.ok(counts.some(c => c === 0) && counts.some(c => c > 1));
});

test("for the mean of normal data it matches the textbook interval", () => {
  const rnd = mulberry(2), xs = draw("normal", 60, rnd), [lo, hi] = ci(bootstrap(xs, "mean", 3000, rnd));
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / 59), half = 2.0 * sd / Math.sqrt(60);
  assert.ok(Math.abs((hi - lo) / 2 - half) / half < 0.12, `${(hi - lo) / 2} vs ${half}`);
});

test("the interval narrows like 1/√n", () => {
  const rnd = mulberry(3), w = n => { const v = bootstrap(draw("normal", n, rnd), "mean", 2000, rnd), [lo, hi] = ci(v); return hi - lo; };
  const r = w(25) / w(400); assert.ok(r > 2.8 && r < 5.5, `ratio ${r}`);
});

test("coverage is about 95% in good conditions", () => {
  const c = coverage("normal", 40, "mean", { trials: 300, B: 400, rnd: mulberry(4) }); assert.ok(c.rate > 0.89 && c.rate < 0.99, `${c.rate}`);
  const m = coverage("skewed", 40, "median", { trials: 300, B: 400, rnd: mulberry(5) }); assert.ok(m.rate > 0.87, `${m.rate}`);
});

test("it fails with tiny samples from wild data", () => {
  const c = coverage("wild", 8, "mean", { trials: 300, B: 400, rnd: mulberry(6) }); assert.ok(c.rate < 0.75, `${c.rate}`);
  assert.equal(median([3, 1, 2]), 2); assert.ok(POPS.wild.mean > POPS.wild.median * 5);
});
