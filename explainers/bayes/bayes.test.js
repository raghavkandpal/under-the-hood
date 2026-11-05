import { test } from "node:test";
import assert from "node:assert/strict";
import { posterior, posteriorNeg, counts } from "./bayes.js";

test("classic screening example: 1% prior, 90% sensitivity, 9% FPR → ~9%", () => {
  assert.ok(Math.abs(posterior(0.01, 0.9, 0.09) - 0.0917) < 0.001);
});

test("a second positive test updates further", () => {
  const p1 = posterior(0.01, 0.9, 0.09), p2 = posterior(p1, 0.9, 0.09);
  assert.ok(p2 > 0.45 && p2 < 0.55, String(p2));
});

test("edge cases and negatives", () => {
  assert.equal(posterior(0, 0.9, 0.1), 0);
  assert.equal(posterior(1, 0.9, 0.1), 1);
  assert.ok(posteriorNeg(0.01, 0.9, 0.09) < 0.002);
});

test("counts add up and match the formula", () => {
  for (const [p, s, f] of [[0.01, 0.9, 0.09], [0.3, 0.7, 0.2], [0.5, 1, 0]]) {
    const c = counts(10000, p, s, f);
    assert.equal(c.tp + c.fn + c.fp + c.tn, 10000);
    assert.ok(Math.abs(c.tp / (c.tp + c.fp) - posterior(p, s, f)) < 0.01);
  }
});
