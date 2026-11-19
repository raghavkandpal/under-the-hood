import { test } from "node:test";
import assert from "node:assert/strict";
import { RATES, VISITORS, RUNS, betaPosterior, betaMean, expectedRegret, betaSample, interval, run, share, summarize } from "./bandits.js";
import { mulberry } from "../../shared/random.js";

test("model constants the page states", () => {
  assert.deepEqual(RATES, [0.10, 0.12]);
  assert.equal(VISITORS, 10000);
  assert.equal(RUNS, 200);
});

test("fact 1: 7 conversions in 10 visits from Beta(1,1) gives Beta(8,4), mean 0.667", () => {
  const p = betaPosterior(7, 10);
  assert.deepEqual(p, { a: 8, b: 4 });
  assert.equal(betaMean(p).toFixed(3), "0.667");
  assert.deepEqual(betaPosterior(0, 0), { a: 1, b: 1 });
});

test("beta sampler has the right mean", () => {
  const rnd = mulberry(5); let s = 0;
  for (let i = 0; i < 20000; i++) s += betaSample({ a: 8, b: 4 }, rnd);
  assert.ok(Math.abs(s / 20000 - 8 / 12) < 0.01, String(s / 20000));
});

test("fact 2: a 50/50 split loses 5,000 x 0.02 = 100 expected conversions", () => {
  assert.ok(Math.abs(expectedRegret([5000, 5000]) - 100) < 1e-9);
  assert.equal(run("split", 1).regret.toFixed(6), "100.000000");
  assert.equal(expectedRegret([0, 10000]), 0);
});

const T = summarize("thompson"), G = summarize("greedy"), S = summarize("split");

test("fact 3: Thompson mean regret over 200 seeded runs is below 100 (about 23)", () => {
  assert.ok(T.meanRegret < 100, String(T.meanRegret));
  assert.equal(Math.round(T.meanRegret), 23);
});

test("fact 4: greedy sends most traffic to the worse arm in 174 of 200 runs, Thompson in 2, the split in 0", () => {
  assert.ok(G.stuck > 0 && T.stuck < G.stuck);
  assert.deepEqual([G.stuck, T.stuck, S.stuck], [174, 2, 0]);
  assert.equal(Math.round(G.meanRegret), 174);
});

test("greedy on seed 1 happens to lock onto the better arm (atypical)", () => {
  assert.deepEqual(run("greedy", 1).visits, [1, 9999]);
});

test("fact 5: on seed 1 Thompson's share on the better arm rises from 72.9% to 96.4%", () => {
  const { choices } = run("thompson", 1);
  const first = share(choices, 0, 1000), last = share(choices, 9000, 10000);
  assert.ok(last > first);
  assert.deepEqual([(first * 100).toFixed(1), (last * 100).toFixed(1)], ["72.9", "96.4"]);
});

test("fact 6: on seed 1 the worse arm's 95% interval is 4.7 points wide under Thompson and 1.6 under the split", () => {
  const t = run("thompson", 1), s = run("split", 1);
  assert.deepEqual(t.visits, [599, 9401]);
  assert.deepEqual(s.visits, [5000, 5000]);
  const wt = interval(t.wins[0], t.visits[0]).width, ws = interval(s.wins[0], s.visits[0]).width;
  assert.ok(wt > ws);
  assert.deepEqual([(wt * 100).toFixed(1), (ws * 100).toFixed(1)], ["4.7", "1.6"]);
});

test("runs are reproducible per seed and visit counts add up", () => {
  const a = run("thompson", 3), b = run("thompson", 3);
  assert.deepEqual(a.choices, b.choices);
  assert.equal(a.visits[0] + a.visits[1], VISITORS);
  assert.equal(a.choices.length, VISITORS);
});
