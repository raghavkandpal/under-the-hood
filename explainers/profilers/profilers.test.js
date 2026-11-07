import { test } from "node:test";
import assert from "node:assert/strict";
import { totalMs, trueSelf, sample, flame, selfCounts } from "./profilers.js";
import { mulberry } from "../../shared/random.js";

test("the program: 80 ms, and parseJson is the hottest function at 35%, split over two callers", () => {
  const t = trueSelf(); assert.equal(totalMs(), 80); assert.ok(Math.abs(t.parseJson - 0.35) < 1e-9);
  assert.equal(Object.entries(t).sort((a, b) => b[1] - a[1])[0][0], "parseJson");
  const f = flame(sample(4000, mulberry(1))), parseBoxes = []; (function go(n) { if (n.name === "parseJson") parseBoxes.push(n); n.children.forEach(go); })(f);
  assert.equal(parseBoxes.length, 2); assert.ok(parseBoxes.every(b => b.count < 0.3 * 4000), "neither box looks like 35%");
});

test("estimates converge like 1/√n", () => {
  const err = n => Math.abs(selfCounts(sample(n, mulberry(n))).parseJson / n - 0.35);
  const sd = n => Math.sqrt(0.35 * 0.65 / n);
  for (const n of [100, 1000, 10000]) assert.ok(err(n) < 3 * sd(n), `n=${n}: ${err(n)}`);
});

test("flame graph widths add up: each box counts its samples, children never exceed parents", () => {
  const f = flame(sample(500, mulberry(2)));
  assert.equal(f.count, 500); (function go(n) { assert.ok(n.children.reduce((a, c) => a + c.count, 0) <= n.count); n.children.forEach(go); })(f);
});
