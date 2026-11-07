import { test } from "node:test";
import assert from "node:assert/strict";
import { sketch, add, estimate, merge, stdError } from "./hyperloglog.js";
import { hash } from "../../shared/hash32.js";

const fill = (p, from, to, repeat = 1) => { const s = sketch(p); for (let r = 0; r < repeat; r++) for (let i = from; i < to; i++) add(s, "user-" + i); return s; };

test("the hash spreads bits evenly", () => {
  let ones = 0; for (let i = 0; i < 10000; i++) ones += hash("k" + i) >>> 31; assert.ok(Math.abs(ones - 5000) < 200, `${ones}`);
});

test("estimates land within a few standard errors, from tens to a million", () => {
  for (const [p, n] of [[10, 50], [10, 5000], [10, 1000000], [6, 20000], [14, 200000]]) {
    const e = estimate(fill(p, 0, n)), err = Math.abs(e - n) / n; assert.ok(err < 3 * stdError(p), `p=${p} n=${n}: ${Math.round(e)} (${(err * 100).toFixed(1)}%)`);
  }
});

test("duplicates change nothing, and merging gives the union", () => {
  assert.equal(estimate(fill(10, 0, 3000, 5)), estimate(fill(10, 0, 3000)));
  const u = estimate(merge(fill(10, 0, 6000), fill(10, 4000, 10000))); assert.ok(Math.abs(u - 10000) / 10000 < 3 * stdError(10), `${u}`);
});

test("1,024 registers: about 3% error in under a kilobyte", () => {
  assert.ok(Math.abs(stdError(10) - 0.0325) < 0.001); assert.equal(sketch(10).reg.length, 1024);
});
