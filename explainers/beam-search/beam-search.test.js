import { test } from "node:test";
import assert from "node:assert/strict";
import { beam, all } from "./beam-search.js";

test("the probabilities after each prefix sum to one, and so do all sentences", () => {
  const s = all(); assert.ok(Math.abs(s.reduce((a, b) => a + b.p, 0) - 1) < 1e-9);
});

test("greedy takes 'the' because it's likelier than 'a', and misses the best sentence", () => {
  const g = beam(1), best = all()[0];
  assert.equal(best.seq, "a quiet night ."); assert.ok(Math.abs(best.p - 0.306) < 1e-9);
  assert.ok(g.best.seq.startsWith("the")); assert.ok(g.best.p < best.p);
});

test("a beam of 2 keeps 'a' alive long enough to find it", () => {
  const b = beam(2); assert.equal(b.best.seq, "a quiet night ."); assert.ok(b.scored < 20);
});

test("a wide enough beam is exhaustive", () => {
  assert.equal(beam(100).best.seq, all()[0].seq);
});
