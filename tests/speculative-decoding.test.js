import { test } from "node:test";
import assert from "node:assert/strict";
import { VOCAB, target, draft, round, generate, acceptRate, expectedPerRound, expectedSpeedup } from "../lib/speculative-decoding.js";
import { mulberry } from "../lib/autograd.js";

test("distributions are valid; a better draft agrees more", () => {
  for (const w of VOCAB) { assert.ok(Math.abs(target(w).reduce((a, b) => a + b) - 1) < 1e-12); assert.ok(Math.abs(draft(w, 0.3).reduce((a, b) => a + b) - 1) < 1e-12); }
  assert.ok(acceptRate(target("cat"), draft("cat", 0.9)) > acceptRate(target("cat"), draft("cat", 0.3)));
  assert.equal(acceptRate(target("cat"), draft("cat", 1)), 1);
});

test("the output distribution equals the big model's, even with a poor draft", () => {
  for (const quality of [0.2, 0.9]) {
    const rnd = mulberry(quality * 10), counts = new Array(VOCAB.length).fill(0), N = 40000;
    for (let i = 0; i < N; i++) counts[VOCAB.indexOf(round("cat", 3, quality, rnd).out[0])]++;
    target("cat").forEach((p, i) => assert.ok(Math.abs(counts[i] / N - p) < 0.012, `q=${quality} ${VOCAB[i]}: ${counts[i] / N} vs ${p}`));
  }
});

test("each round yields 1 to k+1 tokens; a perfect draft always yields k+1", () => {
  const rnd = mulberry(3);
  for (let i = 0; i < 200; i++) { const r = round("the", 4, 0.6, rnd); assert.ok(r.out.length >= 1 && r.out.length <= 5); }
  for (let i = 0; i < 50; i++) assert.equal(round("the", 4, 1, rnd).out.length, 5);
});

test("measured speed-up matches the formula, and a bad draft can make things slower", () => {
  assert.equal(expectedPerRound(1, 4), 5); assert.ok(Math.abs(expectedPerRound(0.5, 2) - 1.75) < 1e-12);
  const g = generate(20000, { k: 4, quality: 1, draftCost: 0.05, rnd: mulberry(4) });
  assert.ok(Math.abs(g.speedup - expectedSpeedup(1, 4, 0.05)) < 0.02, `${g.speedup}`);
  assert.ok(expectedSpeedup(0.1, 8, 0.2) < 1);
});
