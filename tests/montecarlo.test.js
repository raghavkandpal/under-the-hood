import { test } from "node:test";
import assert from "node:assert/strict";
import { darts, project, tri } from "../lib/montecarlo.js";
import { mulberry } from "../lib/autograd.js";

test("π estimate improves like 1/√n", () => {
  const err = n => { let s = 0; for (let k = 1; k <= 30; k++) s += Math.abs(darts(n, k).estimate - Math.PI); return s / 30; };
  const e1 = err(1000), e2 = err(100000);
  assert.ok(e2 < e1 / 5 && e2 > e1 / 20, `${e1} → ${e2}`); // ideal factor 10
  assert.ok(Math.abs(darts(200000, 9).estimate - Math.PI) < 0.02);
});

test("triangular samples stay in range with the right mean", () => {
  const r = mulberry(2); let s = 0;
  for (let i = 0; i < 20000; i++) { const v = tri(r, 2, 3, 10); assert.ok(v >= 2 && v <= 10); s += v; }
  assert.ok(Math.abs(s / 20000 - 5) < 0.05);
});

test("skewed tasks: the 'add up the likely values' plan is usually missed", () => {
  const tasks = [{ min: 3, likely: 4, max: 10 }, { min: 2, likely: 3, max: 9 }, { min: 5, likely: 6, max: 15 }];
  const p = project(tasks, 8000);
  assert.equal(p.plan, 13);
  assert.ok(p.pOnTime(13) < 0.15 && p.p50 > 15 && p.p90 > p.p50);
});
