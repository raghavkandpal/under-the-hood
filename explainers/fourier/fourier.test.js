import { test } from "node:test";
import assert from "node:assert/strict";
import { dft, fft, spectrum, filter, synth } from "./fourier.js";
import { mulberry } from "../../shared/random.js";

test("FFT matches the naive DFT", () => {
  const r = mulberry(2), x = Array.from({ length: 64 }, () => r() - 0.5);
  const a = dft(x), b = fft(x);
  for (let k = 0; k < 64; k++) { assert.ok(Math.abs(a.re[k] - b.re[k]) < 1e-9); assert.ok(Math.abs(a.im[k] - b.im[k]) < 1e-9); }
});

test("inverse round-trips", () => {
  const r = mulberry(3), x = Array.from({ length: 128 }, () => r());
  const { re, im } = fft(x), back = fft(re, im, true).re;
  x.forEach((v, i) => assert.ok(Math.abs(v - back[i]) < 1e-9));
});

test("sines show up at their frequency with their amplitude", () => {
  const s = spectrum(synth(256, [{ freq: 5, amp: 1 }, { freq: 20, amp: 0.4 }]));
  assert.ok(Math.abs(s[5] - 1) < 1e-9 && Math.abs(s[20] - 0.4) < 1e-9);
  assert.ok(s.every((v, k) => k === 5 || k === 20 || v < 1e-9));
});

test("low-pass filter removes the high tone", () => {
  const x = synth(256, [{ freq: 3, amp: 1 }, { freq: 40, amp: 1 }]), y = filter(x, f => f < 10), pure = synth(256, [{ freq: 3, amp: 1 }]);
  y.forEach((v, i) => assert.ok(Math.abs(v - pure[i]) < 1e-9));
});

test("Parseval: energy is preserved", () => {
  const r = mulberry(5), x = Array.from({ length: 64 }, () => r() - 0.5), { re, im } = fft(x);
  const et = x.reduce((s, v) => s + v * v, 0), ef = re.reduce((s, v, k) => s + v * v + im[k] * im[k], 0) / 64;
  assert.ok(Math.abs(et - ef) < 1e-9);
});
