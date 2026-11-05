import { test } from "node:test";
import assert from "node:assert/strict";
import { erlangC, theoryW, simulate } from "./queue.js";

test("M/M/1 closed form: W = 1/(μ-λ)", () => {
  assert.ok(Math.abs(theoryW(0.8, 1, 1) - 5) < 1e-9);
  assert.equal(theoryW(1, 1, 1), Infinity);
  assert.ok(Math.abs(erlangC(1, 0.5) - 0.5) < 1e-12);
});

test("simulation matches theory for M/M/1 and M/M/3", () => {
  for (const [lambda, mu, c] of [[0.5, 1, 1], [0.8, 1, 1], [2.4, 1, 3]]) {
    const s = simulate({ lambda, mu, servers: c, n: 80000, seed: 4 }), th = theoryW(lambda, mu, c);
    assert.ok(Math.abs(s.W - th) / th < 0.08, `λ=${lambda} c=${c}: sim ${s.W.toFixed(2)} vs ${th.toFixed(2)}`);
  }
});

test("Little's law: L ≈ λW", () => {
  const s = simulate({ lambda: 0.7, mu: 1, servers: 1, n: 60000, seed: 2 });
  assert.ok(Math.abs(s.L - s.lambdaEff * s.W) / s.L < 0.05, `L ${s.L} vs λW ${s.lambdaEff * s.W}`);
});

test("one shared line beats separate lines at the same load", () => {
  const p = simulate({ lambda: 2.4, mu: 1, servers: 3, pooled: true, n: 40000, seed: 5 });
  const s = simulate({ lambda: 2.4, mu: 1, servers: 3, pooled: false, n: 40000, seed: 5 });
  assert.ok(s.Wq > 2 * p.Wq, `separate ${s.Wq} vs pooled ${p.Wq}`);
});
