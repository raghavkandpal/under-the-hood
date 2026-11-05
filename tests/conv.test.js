import { test } from "node:test";
import assert from "node:assert/strict";
import { KERNELS, convolve, gaussian, sobelMagnitude, explainPixel } from "../lib/conv.js";

const W = 8, H = 6;
const flat = v => new Float32Array(W * H).fill(v);
const edge = () => { const a = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = x >= 4 ? 1 : 0; return a; };

test("identity leaves the image alone; blurs keep a flat image flat", () => {
  const img = edge(); assert.deepEqual([...convolve(img, W, H, KERNELS.identity.k)], [...img]);
  for (const k of ["box", "gauss"]) for (const v of convolve(flat(0.3), W, H, KERNELS[k].k)) assert.ok(Math.abs(v - 0.3) < 1e-6);
});

test("gaussian kernels sum to 1 and peak in the middle", () => {
  const g = gaussian(5, 1); assert.ok(Math.abs(g.flat().reduce((a, b) => a + b) - 1) < 1e-9); assert.equal(Math.max(...g.flat()), g[2][2]);
});

test("Sobel x responds to a vertical edge, Sobel y doesn't", () => {
  const img = edge(), gx = convolve(img, W, H, KERNELS.sobelX.k), gy = convolve(img, W, H, KERNELS.sobelY.k);
  assert.ok(Math.abs(gx[2 * W + 4]) > 3 && Math.abs(gx[2 * W + 1]) < 1e-9);
  assert.ok([...gy].every(v => Math.abs(v) < 1e-9));
  assert.ok(sobelMagnitude(img, W, H)[2 * W + 3] > 3);
});

test("explainPixel matches convolve", () => {
  const img = edge(), out = convolve(img, W, H, KERNELS.sharpen.k);
  for (const [x, y] of [[0, 0], [3, 2], [4, 5]]) assert.ok(Math.abs(explainPixel(img, W, H, KERNELS.sharpen.k, x, y).sum - out[y * W + x]) < 1e-6);
});
