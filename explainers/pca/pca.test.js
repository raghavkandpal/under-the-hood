import { test } from "node:test";
import assert from "node:assert/strict";
import { cloud, pca2, reconstruct, reconError } from "./pca.js";

test("recovers the stretch direction of a rotated cloud", () => {
  const ang = 0.6, m = pca2(cloud(4000, { spread: 3, thin: 0.5, angle: ang, seed: 2 }));
  const [ux, uy] = m.vectors[0];
  assert.ok(Math.abs(Math.abs(ux * Math.cos(ang) + uy * Math.sin(ang)) - 1) < 0.01);
  assert.ok(Math.abs(m.values[0] - 9) / 9 < 0.08 && Math.abs(m.values[1] - 0.25) / 0.25 < 0.12);
});

test("components are orthonormal; variance along PC1 equals λ1", () => {
  const pts = cloud(500, { seed: 3 }), m = pca2(pts), [a, b] = m.vectors;
  assert.ok(Math.abs(a[0] * b[0] + a[1] * b[1]) < 1e-12 && Math.abs(Math.hypot(...a) - 1) < 1e-12);
  const ts = reconstruct(pts, m).map(r => r.t), v = ts.reduce((s, t) => s + t * t, 0) / (ts.length - 1);
  assert.ok(Math.abs(v - m.values[0]) < 1e-9);
});

test("reconstruction error from dropping PC2 ≈ λ2 (scaled)", () => {
  const pts = cloud(800, { seed: 4 }), m = pca2(pts), err = reconError(pts, reconstruct(pts, m));
  assert.ok(Math.abs(err - m.values[1] * (pts.length - 1) / pts.length) < 1e-9);
});

test("round cloud: both components explain about half", () => {
  const m = pca2(cloud(3000, { spread: 1, thin: 1, seed: 5 }));
  assert.ok(Math.abs(m.explained[0] - 0.5) < 0.06);
});
