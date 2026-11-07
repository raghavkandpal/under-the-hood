import { test } from "node:test";
import assert from "node:assert/strict";
import { WEATHER, evolve, stationary, step, walk, setProb } from "./markov-chains.js";
import { mulberry } from "../../shared/random.js";

const close = (a, b, eps) => a.every((x, i) => Math.abs(x - b[i]) < eps);

test("the long-run mix doesn't change from one day to the next", () => {
  const pi = stationary(WEATHER); assert.ok(close(step(pi, WEATHER), pi, 1e-12)); assert.ok(Math.abs(pi.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(close(pi, [0.4565, 0.2826, 0.2609], 1e-3), `${pi}`);
});

test("wherever you start, after a couple of weeks the forecast is the same", () => {
  const pi = stationary(WEATHER);
  for (const s of [[1, 0, 0], [0, 0, 1]]) assert.ok(close(evolve(s, WEATHER, 14).at(-1), pi, 1e-3));
  assert.ok(!close(evolve([1, 0, 0], WEATHER, 1).at(-1), pi, 0.1), "but tomorrow still depends on today");
});

test("a long random walk spends time in each state in proportion to π", () => {
  assert.ok(close(walk(WEATHER, 0, 100000, mulberry(1)).freq, stationary(WEATHER), 0.01));
});

test("editing one probability keeps the row summing to one", () => {
  const P = setProb(WEATHER, 0, 0, 0.9); assert.ok(Math.abs(P[0].reduce((a, b) => a + b) - 1) < 1e-12); assert.equal(P[0][0], 0.9);
  assert.ok(Math.abs(P[0][1] / P[0][2] - 2) < 1e-12, "the others keep their ratio");
});
