import { test } from "node:test";
import assert from "node:assert/strict";
import { targetUpdate, lowRank, norm, sub, params } from "./lora.js";
import { mulberry } from "../../shared/random.js";

test("a matrix of rank 4 is rebuilt exactly from rank 4", () => {
  const M = targetUpdate({ rank: 4, noise: 0, rnd: mulberry(1) });
  assert.ok(norm(sub(M, lowRank(M, 4).approx)) / norm(M) < 1e-6);
  assert.ok(norm(sub(M, lowRank(M, 2).approx)) / norm(M) > 0.1);
});

test("error falls with every extra rank, and most of it is gone after the strong directions", () => {
  const M = targetUpdate({ rnd: mulberry(2) }), err = r => norm(sub(M, lowRank(M, r).approx)) / norm(M);
  const e = [1, 2, 4, 8, 16].map(err); e.reduce((a, b) => (assert.ok(b < a, `${e}`), b));
  assert.ok(e[2] < 0.3, `${e}`);
});

test("singular values come out largest first", () => {
  const s = lowRank(targetUpdate({ rnd: mulberry(3) }), 6).sigmas; s.reduce((a, b) => (assert.ok(b <= a + 1e-9), b));
});

test("parameter counts: a 4096-wide layer at rank 8 trains 0.4% of the weights", () => {
  const p = params(4096, 8); assert.equal(p.lora, 65536); assert.ok(Math.abs(p.lora / p.full - 0.0039) < 0.0001);
});
