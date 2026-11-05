import { test } from "node:test";
import assert from "node:assert/strict";
import { alphaBar, noisy, denoise, sample, nearestDist, shape, gauss } from "../lib/diffusion.js";
import { mulberry } from "../lib/autograd.js";

test("the schedule goes from all signal to (almost) all noise", () => {
  assert.ok(Math.abs(alphaBar(0) - 1) < 1e-9); assert.ok(alphaBar(0.999) < 1e-4);
  for (let t = 0; t < 0.9; t += 0.1) assert.ok(alphaBar(t + 0.05) < alphaBar(t));
});

test("at t≈1 noised data looks like a standard normal", () => {
  const rnd = mulberry(1), data = shape("spiral", 400, rnd), xs = data.map(d => noisy(d, 0.999, [gauss(rnd), gauss(rnd)]));
  const mx = xs.reduce((s, x) => s + x[0], 0) / xs.length, vx = xs.reduce((s, x) => s + x[0] ** 2, 0) / xs.length;
  assert.ok(Math.abs(mx) < 0.15); assert.ok(Math.abs(vx - 1) < 0.2);
});

test("denoising a barely-noisy point snaps to its source", () => {
  const data = [[1, 0], [-1, 0]], d = denoise(noisy([1, 0], 0.05, [0.1, 0.1]), 0.05, data);
  assert.ok(Math.hypot(d[0] - 1, d[1]) < 0.01);
});

test("reverse process lands on the data; blur lands near it but not on it", () => {
  const rnd = mulberry(2), data = shape("moons", 120, rnd);
  const exact = sample(data, 60, { rnd, steps: 40 }).at(-1), blurred = sample(data, 60, { rnd, steps: 40, blur: 0.3 }).at(-1);
  const med = a => a.map(p => nearestDist(p, data)).sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med(exact) < 0.03, `exact median ${med(exact)}`);
  assert.ok(med(blurred) > 2 * med(exact) && med(blurred) < 0.3, `blurred median ${med(blurred)}`);
});
