import { test } from "node:test";
import assert from "node:assert/strict";
import { sample, fit, mse, errorCurve, legendre, solve } from "../lib/regression.js";

test("solve handles a small system", () => {
  const x = solve([[2, 1], [1, 3]], [3, 5]);
  assert.ok(Math.abs(x[0] - 0.8) < 1e-12 && Math.abs(x[1] - 1.4) < 1e-12);
});

test("legendre P2 and P3", () => {
  const [, , p2, p3] = legendre(0.5, 3);
  assert.ok(Math.abs(p2 - (3 * 0.25 - 1) / 2) < 1e-12);
  assert.ok(Math.abs(p3 - (5 * 0.125 - 3 * 0.5) / 2) < 1e-12);
});

test("exact fit through points with enough degree", () => {
  const pts = [-0.9, -0.3, 0.2, 0.7].map(x => ({ x, y: 1 - 2 * x + 3 * x ** 3 }));
  const m = fit(pts, 3);
  for (const p of pts) assert.ok(Math.abs(m.predict(p.x) - p.y) < 1e-8);
});

test("train error falls with degree; test error is U-shaped", () => {
  const train = sample("wave", 15, 0.25, 1), test = sample("wave", 400, 0.25, 2);
  const c = errorCurve(train, test, 12, 0);
  for (let d = 1; d < c.length; d++) assert.ok(c[d].train <= c[d - 1].train + 1e-9, `train rose at ${d}`);
  const best = c.reduce((a, b) => (b.test < a.test ? b : a));
  assert.ok(best.deg >= 2 && best.deg <= 8, `best ${best.deg}`);
  assert.ok(c[12].test > best.test * 2, "high degree overfits");
});

test("ridge tames a high-degree fit", () => {
  const train = sample("wave", 15, 0.25, 1), test = sample("wave", 400, 0.25, 2);
  assert.ok(mse(fit(train, 12, 1e-3), test) < mse(fit(train, 12, 0), test));
});
