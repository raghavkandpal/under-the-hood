import { test } from "node:test";
import assert from "node:assert/strict";
import { SURFACES, OPTIMIZERS, evalAt, valueAt, run } from "../lib/optim.js";

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

test("autograd gradients match finite differences on every surface", () => {
  for (const s of Object.keys(SURFACES)) for (const [x, y] of [[0.3, -0.4], [-1.1, 0.9], [1.7, 1.2]]) {
    const { g } = evalAt(s, x, y), h = 1e-6;
    const nx = (valueAt(s, x + h, y) - valueAt(s, x - h, y)) / (2 * h);
    const ny = (valueAt(s, x, y + h) - valueAt(s, x, y - h)) / (2 * h);
    assert.ok(Math.abs(g[0] - nx) < 1e-4 && Math.abs(g[1] - ny) < 1e-4, `${s} @ ${x},${y}`);
  }
});

test("stated minima are stationary", () => {
  for (const [k, s] of Object.entries(SURFACES)) {
    const { g } = evalAt(k, ...s.min);
    assert.ok(Math.hypot(...g) < 0.05, `${k}: |g| = ${Math.hypot(...g)}`);
  }
});

test("every optimizer converges on the bowl", () => {
  for (const o of Object.keys(OPTIMIZERS)) {
    const path = run("bowl", o, SURFACES.bowl.start, { lr: 0.3, steps: 400 });
    assert.ok(dist(path.at(-1), [0, 0]) < 0.05, `${o} ended at ${path.at(-1)}`);
  }
});

test("plain GD diverges when the learning rate is too big", () => {
  const path = run("bowl", "sgd", [1, 1], { lr: 2.2, steps: 200 });
  assert.equal(path.at(-1)[2], Infinity);
});

test("momentum beats plain GD in the narrow valley", () => {
  const a = run("valley", "sgd", SURFACES.valley.start, { lr: 0.4, steps: 150 }).at(-1);
  const b = run("valley", "momentum", SURFACES.valley.start, { lr: 0.04, steps: 150 }).at(-1);
  assert.ok(b[2] < a[2], `momentum ${b[2]} vs sgd ${a[2]}`);
});
