import { test } from "node:test";
import assert from "node:assert/strict";
import { FixedWindow, SlidingLog, TokenBucket, run, worstWindow, makeTraffic } from "./ratelimit.js";

test("each limiter enforces its basic rule", () => {
  const f = new FixedWindow(3, 1); assert.deepEqual([0.1, 0.2, 0.3, 0.4, 1.05].map(t => f.allow(t)), [true, true, true, false, true]);
  // at 1.05 the 0.1 request is still inside the last second; by 1.15 it has aged out
  const s = new SlidingLog(3, 1); assert.deepEqual([0.1, 0.2, 0.3, 1.05, 1.15, 1.25, 1.27].map(t => s.allow(t)), [true, true, true, false, true, true, false]);
  const b = new TokenBucket(2, 1); assert.deepEqual([0, 0, 0, 0.5, 1.01].map(t => b.allow(t)), [true, true, false, false, true]);
});

test("fixed windows allow ~2× the limit across a boundary; sliding never exceeds it", () => {
  const times = makeTraffic("boundary", 10, 3), limit = 10, w = 1;
  assert.ok(worstWindow(run("fixed", times, limit, w), w) > limit * 1.5);
  assert.ok(worstWindow(run("sliding", times, limit, w), w) <= limit);
});

test("token bucket admits short bursts up to capacity but holds the long-run rate", () => {
  const times = makeTraffic("overload", 20, 2), r = run("bucket", times, 10, 1);
  const accepted = r.filter(x => x.ok).length;
  assert.ok(accepted <= 10 + 10 * 20 + 1 && accepted >= 10 * 20 * 0.9, String(accepted));
});

test("steady traffic under the limit is never rejected", () => {
  const times = makeTraffic("steady", 10, 1);
  for (const k of ["sliding", "bucket"]) assert.ok(run(k, times, 20, 1).every(x => x.ok), k);
});
