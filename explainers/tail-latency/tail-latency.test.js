import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAF, MODES, leafMean, leafFastShare, pSlowRequest, extraCalls, simulate, view } from "./tail-latency.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

test("one leaf: mean 19.9 ms while 99% of calls take 10 ms", () => {
  near(leafMean(), 19.9, 1e-9);
  assert.equal(leafFastShare(), 0.99);
  assert.equal(LEAF.fast, 10);
});

test("fan-out: P(slow) = 1 - 0.99^n, formula and seeded run", () => {
  for (const [n, p] of [[1, 0.01], [10, 0.0956], [100, 0.634]]) {
    near(pSlowRequest(n), p, 1e-3);
    near(simulate(n, "plain").slowRate, p, 0.02);
  }
});

test("at n = 100 the median request takes 1,000 ms; at n = 1 and 10 it takes 10", () => {
  assert.equal(simulate(100, "plain").median, 1000);
  assert.equal(simulate(10, "plain").median, 10);
  assert.equal(simulate(1, "plain").median, 10);
});

test("hedging: a leaf is slow only if both copies are; median falls to 30 ms", () => {
  near(pSlowRequest(100, "hedge"), 0.00995, 1e-5);
  near(simulate(100, "hedge").slowRate, 0.00995, 0.005);
  assert.equal(simulate(100, "hedge").median, 30);
  assert.equal(simulate(10, "hedge").median, 10);
  assert.equal(pSlowRequest(100, "double"), pSlowRequest(100, "hedge"));
});

test("hedge costs 1% extra calls, two copies of everything costs 100%", () => {
  assert.equal(extraCalls("hedge"), 0.01);
  assert.equal(extraCalls("double"), 1);
  assert.equal(extraCalls("plain"), 0);
  for (const n of [1, 10, 100]) {
    near(simulate(n, "hedge").extra, 0.01, 0.005);
    assert.equal(simulate(n, "double").extra, 1);
    assert.equal(simulate(n, "plain").extra, 0);
  }
});

test("seeded runs repeat", () => assert.deepEqual(simulate(100, "hedge"), simulate(100, "hedge")));

test("the page's view follows n and mode: every field changes with its inputs", () => {
  const seen = new Set();
  for (const mode of Object.keys(MODES)) for (const n of [1, 10, 100]) {
    const v = view(n, mode);
    near(v.formula, pSlowRequest(n, mode), 0);
    near(v.slowRate, v.formula, 0.02);
    near(v.extra, v.expectedExtra, 0.005);
    seen.add(`${v.formula}|${v.median}|${v.expectedExtra}`);
  }
  assert.equal(view(100, "plain").median, 1000);
  assert.equal(view(100, "hedge").median, 30);
  assert.equal(view(100, "hedge").leafMean, 19.9);
  assert.ok(seen.size >= 6);
  // changing only n, then only mode, changes the readout
  assert.notEqual(view(10, "plain").formula, view(100, "plain").formula);
  assert.notEqual(view(100, "plain").median, view(100, "hedge").median);
});
