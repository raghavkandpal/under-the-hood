import { test } from "node:test";
import assert from "node:assert/strict";
import { Bloom, fpRate, optimalK, pseudoWords } from "../lib/bloom.js";

test("no false negatives, ever", () => {
  const b = new Bloom(50, 4), ws = pseudoWords(80, 3);
  for (const w of ws) b.add(w);
  for (const w of ws) assert.ok(b.has(w).maybe, w);
});

test("positions are in range and distinct-ish", () => {
  const b = new Bloom(97, 5);
  for (const w of pseudoWords(50)) { const p = b.positions(w); assert.equal(p.length, 5); p.forEach(i => assert.ok(i >= 0 && i < 97)); }
});

test("measured false-positive rate tracks the formula", () => {
  const m = 2000, n = 300, k = optimalK(m, n), b = new Bloom(m, k);
  const all = pseudoWords(n + 4000, 11), ins = all.slice(0, n), out = all.slice(n);
  ins.forEach(w => b.add(w));
  const fp = out.filter(w => b.has(w).maybe).length / out.length, th = fpRate(m, k, n);
  assert.ok(Math.abs(fp - th) < Math.max(0.01, th * 0.5), `measured ${fp} vs theory ${th}`);
});

test("optimal k is about (m/n) ln 2", () => {
  assert.equal(optimalK(1000, 100), 7);
  assert.equal(optimalK(10, 100), 1);
});
