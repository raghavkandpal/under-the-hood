import { test } from "node:test";
import assert from "node:assert/strict";
import { Grid, QLearner, valueIteration } from "./rl.js";

const CLIFF = [
  "........",
  "........",
  "S......G",
  "XXXXXXXX",
];

test("value iteration finds the shortest safe path length", () => {
  const g = new Grid(CLIFF), { policy } = valueIteration(g);
  let s = g.start, steps = 0;
  while (!g.terminal(s) && steps < 50) { s = g.move(s, policy[s]); steps++; }
  assert.equal(g.at(s), "G"); assert.equal(steps, 7);
});

test("Q-learning learns to reach the goal and its greedy policy matches", () => {
  const g = new Grid(CLIFF), q = new QLearner(g, { seed: 3, epsilon: 0.2 });
  for (let i = 0; i < 400; i++) q.episode();
  const path = q.policyPath();
  assert.equal(g.at(path.at(-1)), "G");
  assert.equal(path.length - 1, 7);
  const late = q.history.slice(-50).reduce((a, b) => a + b) / 50, early = q.history.slice(0, 20).reduce((a, b) => a + b) / 20;
  assert.ok(late > early, `${early} → ${late}`);
});

test("slippery floor makes the planner keep away from the cliff", () => {
  const g = new Grid(CLIFF, { slip: 0.2 }), { policy } = valueIteration(g);
  // from the start, the safe plan heads up first rather than hugging the cliff edge
  assert.equal(policy[g.start], 0);
});

test("near vs far: γ decides the optimum; optimistic init lets Q-learning find it", () => {
  const lay = ["..........", ".G.......G", "..........", "S.........", ".........."];
  const make = () => { const g = new Grid(lay); const base = g.reward.bind(g); g.reward = s => (s === 11 ? 5 : base(s)); return g; };
  const ends = (g, policyStep) => { let s = g.start, n = 0; while (!g.terminal(s) && n++ < 40) s = policyStep(s); return s; };
  for (const [gamma, want] of [[0.6, 11], [0.95, 19]]) {
    const g = make(), { policy } = valueIteration(g, gamma);
    assert.equal(ends(g, s => g.move(s, policy[s])), want, `VI γ=${gamma}`);
    const q = new QLearner(g, { gamma, epsilon: 0.1, seed: 2, init: 20 });
    for (let i = 0; i < 600; i++) q.episode();
    assert.equal(q.policyPath().at(-1), want, `Q γ=${gamma}`);
  }
  const g = make(), plain = new QLearner(g, { gamma: 0.95, epsilon: 0.2, seed: 2 });
  for (let i = 0; i < 600; i++) plain.episode();
  assert.equal(plain.policyPath().at(-1), 11, "zero-init learner gets stuck on the near reward");
});

test("walls block movement", () => {
  const g = new Grid(["S#G"]);
  assert.equal(g.move(0, 1), 0);
});
