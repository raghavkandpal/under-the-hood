import { test } from "node:test";
import assert from "node:assert/strict";
import { dct, idct, qtable, ZIGZAG, compress } from "./jpeg.js";
import { mulberry } from "../../shared/random.js";

test("DCT then inverse DCT round-trips", () => {
  const r = mulberry(1), b = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => r() * 255 - 128));
  const back = idct(dct(b)); b.forEach((row, y) => row.forEach((v, x) => assert.ok(Math.abs(v - back[y][x]) < 1e-9)));
});

test("a flat block has only a DC coefficient", () => {
  const F = dct(Array.from({ length: 8 }, () => new Array(8).fill(50)));
  assert.ok(Math.abs(F[0][0] - 400) < 1e-9);
  F.forEach((row, v) => row.forEach((c, u) => { if (u || v) assert.ok(Math.abs(c) < 1e-9); }));
});

test("zig-zag covers all 64 cells; quality scaling behaves", () => {
  assert.equal(new Set(ZIGZAG.map(p => p.join())).size, 64);
  assert.deepEqual(ZIGZAG.slice(0, 4), [[0, 0], [0, 1], [1, 0], [2, 0]]);
  assert.ok(qtable(10)[0][0] > qtable(50)[0][0] && qtable(50)[0][0] > qtable(95)[0][0]);
});

test("lower quality: fewer coefficients, smaller size, more error", () => {
  const w = 32, h = 32, img = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img[y * w + x] = 128 + 80 * Math.sin(x / 3) * Math.cos(y / 5) + (x > 16 ? 40 : 0);
  const hi = compress(img, w, h, 90), lo = compress(img, w, h, 10);
  assert.ok(lo.nonzero < hi.nonzero && lo.bytes < hi.bytes && lo.psnr < hi.psnr);
  assert.ok(hi.psnr > 30);
});
