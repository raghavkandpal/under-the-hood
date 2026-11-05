import { test } from "node:test";
import assert from "node:assert/strict";
import { quantize, dequantize, relError, levelsUsed, bitsPerWeight, modelGB, weights } from "./quant.js";
import { mulberry } from "../../shared/random.js";

const w = weights(8192, mulberry(4));

test("each weight is off by at most half a step", () => {
  const Q = quantize(w, 8, 64), d = dequantize(Q);
  for (let i = 0; i < w.length; i++) assert.ok(Math.abs(w[i] - d[i]) <= Q.scales[Math.floor(i / 64)] / 2 + 1e-12);
});

test("more bits, less error", () => {
  const e = [2, 3, 4, 8].map(b => relError(w, dequantize(quantize(w, b, 64))));
  for (let i = 1; i < e.length; i++) assert.ok(e[i] < e[i - 1]);
  assert.ok(e[3] < 0.01);
});

test("outliers waste levels with one scale; small groups rescue them", () => {
  const whole = quantize(w, 4), grouped = quantize(w, 4, 32);
  assert.ok(relError(w, dequantize(grouped)) < relError(w, dequantize(whole)) / 2);
  assert.ok(levelsUsed(whole) < 15);
});

test("memory arithmetic", () => {
  assert.equal(modelGB(7, 16), 14); assert.equal(bitsPerWeight(4, 32), 4.5); assert.equal(bitsPerWeight(8, Infinity), 8);
});
