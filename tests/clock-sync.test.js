import { test } from "node:test";
import assert from "node:assert/strict";
import { exchange, estimate, sample, driftSeries } from "../lib/clock-sync.js";
import { mulberry } from "../lib/autograd.js";

test("with a symmetric path the offset is measured exactly", () => {
  const e = estimate(exchange({ clientOffset: 137, out: 25, back: 25 }));
  assert.equal(-e.offset, 137); assert.equal(e.delay, 50);
});

test("an asymmetric path biases the estimate by half the difference, never more than half the delay", () => {
  const e = estimate(exchange({ clientOffset: 0, out: 40, back: 10 }));
  assert.equal(e.offset, 15); assert.equal(e.delay, 50); assert.ok(Math.abs(e.offset) <= e.delay / 2);
  for (const [out, back] of [[1, 99], [99, 1], [30, 30]]) { const x = estimate(exchange({ clientOffset: -5, out, back })); assert.ok(Math.abs(-x.offset - -5) <= x.delay / 2 + 1e-9); }
});

test("keeping the lowest-delay sample beats averaging under jitter", () => {
  const r = sample(16, { clientOffset: 300, jitter: 80, rnd: mulberry(5) });
  assert.ok(Math.abs(r.best.error) < Math.abs(r.avgError) || Math.abs(r.best.error) < 2, `best ${r.best.error} avg ${r.avgError}`);
  assert.ok(Math.abs(r.best.error) <= r.best.delay / 2);
});

test("asymmetry can't be filtered away", () => {
  const r = sample(32, { clientOffset: 0, jitter: 0, asym: 30, rnd: mulberry(1) }); assert.ok(Math.abs(Math.abs(r.best.error) - 15) < 1e-9);
});

test("drift accumulates between syncs: 20 ppm over 64 s is about 1.3 ms", () => {
  const d = driftSeries(200, { ppm: 20, interval: 64, residual: 0 });
  assert.ok(Math.abs(d[63] - 1.26) < 1e-9); assert.equal(d[64], 0); assert.ok(Math.max(...d) < 1.3);
});
