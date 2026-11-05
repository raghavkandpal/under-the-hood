import { test } from "node:test";
import assert from "node:assert/strict";
import { softmax, attend, tokenize, runHead, HEADS } from "./attention.js";

const argmax = a => a.indexOf(Math.max(...a));

test("softmax is a distribution and temperature sharpens it", () => {
  const p = softmax([1, 2, 3]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(softmax([1, 2, 3], 0.1)[2] > 0.99);
  assert.ok(Math.abs(softmax([1, 2, 3], 100)[0] - 1 / 3) < 0.01);
  assert.deepEqual(softmax([-Infinity, 0]), [0, 1]);
});

test("attention output is a weighted average of values; causal mask hides the future", () => {
  const Q = [[1, 0], [0, 1]], K = [[1, 0], [0, 1]], V = [[10, 0], [0, 10]];
  const r = attend(Q, K, V);
  r.weights.forEach(w => assert.ok(Math.abs(w[0] + w[1] - 1) < 1e-12));
  assert.ok(Math.abs(r.out[0][0] - 10 * r.weights[0][0]) < 1e-9);
  const c = attend(Q, K, V, { causal: true });
  assert.equal(c.weights[0][1], 0);
  assert.equal(c.weights[0][0], 1);
});

test("heads behave as described", () => {
  const toks = tokenize("The cat chased the ball because it was happy.");
  const at = w => toks.indexOf(w);
  const coref = runHead(toks, "coref").weights[at("it")];
  assert.ok([at("cat"), at("ball")].includes(argmax(coref)));
  assert.ok(coref[at("cat")] + coref[at("ball")] > 0.8);
  const subj = runHead(toks, "subject").weights[at("chased")];
  assert.equal(argmax(subj), at("cat"));
  const adj = runHead(toks, "adjective").weights[at("happy")];
  assert.ok(adj[at("cat")] + adj[at("ball")] + adj[at("it")] > 0.8);
  const prev = runHead(toks, "previous").weights;
  for (let i = 1; i < toks.length; i++) assert.equal(argmax(prev[i]), i - 1);
});

test("all heads produce valid distributions for unknown words too", () => {
  const toks = tokenize("Zorbs glimmer quietly near the river");
  for (const h of Object.keys(HEADS)) for (const row of runHead(toks, h, { causal: true }).weights) {
    assert.ok(Math.abs(row.reduce((a, b) => a + b) - 1) < 1e-9, h);
  }
});
