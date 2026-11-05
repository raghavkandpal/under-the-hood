import { test } from "node:test";
import assert from "node:assert/strict";
import { steps, duration, ALGOS } from "../lib/complexity.js";

test("measured step counts follow their Big-O class", () => {
  const a = steps(1024), b = steps(2048);
  assert.equal(b.index / a.index, 1);
  assert.ok(b.binary - a.binary <= 1);                     // doubling n adds one step
  assert.equal(b.linear / a.linear, 2);
  const r = b.merge / a.merge; assert.ok(r > 2 && r < 2.3);  // a bit more than double
  assert.ok(Math.abs(b.pairs / a.pairs - 4) < 0.01);
});

test("binary search on 1,000,000 items takes about 20 steps", () => { const s = steps(1e6).binary; assert.ok(s >= 19 && s <= 21); });

test("durations read sensibly", () => {
  assert.equal(duration(1), "< 1 µs"); assert.equal(duration(3e9), "3.0 s"); assert.equal(duration(2 ** 100), "longer than the age of the universe");
  assert.equal(Object.keys(ALGOS).length, 6);
});
