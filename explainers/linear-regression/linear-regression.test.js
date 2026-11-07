import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, sse, noisy } from "./linear-regression.js";
import { mulberry } from "../../shared/random.js";

test("points on a line are fitted exactly", () => {
  const f = fit([[0, 1], [1, 3], [2, 5], [3, 7]]);
  assert.ok(Math.abs(f.slope - 2) < 1e-12 && Math.abs(f.intercept - 1) < 1e-12); assert.equal(f.r2, 1);
});

test("the fitted line has the smallest squared error: nudging it only makes things worse", () => {
  const pts = noisy({ rnd: mulberry(1) }), f = fit(pts);
  for (const [db, da] of [[0.05, 0], [-0.05, 0], [0, 0.2], [0, -0.2]]) assert.ok(sse(pts, f.slope + db, f.intercept + da) > f.sse);
});

test("with enough data it recovers the true line; one far outlier drags it", () => {
  const pts = noisy({ n: 2000, rnd: mulberry(2) }), f = fit(pts);
  assert.ok(Math.abs(f.slope - 0.8) < 0.03 && Math.abs(f.intercept - 2) < 0.15, `${f.slope} ${f.intercept}`);
  const small = noisy({ n: 20, noise: 0.3, rnd: mulberry(3) }), dragged = fit([...small, [10, -10]]);
  assert.ok(dragged.slope < 0.65 * fit(small).slope, `one point in 21 cuts the slope from ${fit(small).slope} to ${dragged.slope}`);
});

test("R² falls as noise rises", () => {
  const r = noise => fit(noisy({ n: 500, noise, rnd: mulberry(4) })).r2;
  assert.ok(r(0.2) > 0.95 && r(3) < 0.5, `${r(0.2)} ${r(3)}`);
});
