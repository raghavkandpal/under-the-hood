import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry } from "../../shared/random.js";
import { route, softmax, paramCounts, capacityRun, auxLoss, makeTokens, initRouter, stats, train } from "./mixture-of-experts.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const TRAIN = { alpha: 10, lr: 0.05, steps: 600 };

test("routing keeps exactly k non-zero weights that sum to 1", () => {
  const rnd = mulberry(7);
  for (const E of [4, 8, 16]) for (let k = 1; k <= 4; k++) for (let t = 0; t < 20; t++) {
    const scores = Array.from({ length: E }, () => 6 * rnd() - 3), { weights, chosen } = route(scores, k);
    assert.equal(weights.filter(w => w > 0).length, k);
    close(weights.reduce((a, b) => a + b, 0), 1);
    const best = scores.indexOf(Math.max(...scores));
    assert.ok(chosen.includes(best));
    for (const i of chosen) for (let j = 0; j < E; j++) if (!chosen.includes(j)) assert.ok(scores[i] >= scores[j]);
  }
});

test("renormalised weights keep the ratio of the router probabilities", () => {
  const { probs, weights, chosen } = route([2, 1, 0, -1], 2);
  close(weights[chosen[0]] / weights[chosen[1]], probs[chosen[0]] / probs[chosen[1]]);
  close(softmax([1, 2, 3]).reduce((a, b) => a + b, 0), 1);
});

test("with E = 8 and k = 2 a token uses 25% of the expert parameters", () => {
  assert.equal(paramCounts({ shared: 3, expert: 7, E: 8, k: 2 }).expertShare, 0.25);
});

test("total and active parameters, summed expert by expert, at the page's values", () => {
  for (const E of [2, 4, 8, 16, 32, 64]) for (const k of [1, 2, 3, 4]) {
    const kk = Math.min(k, E), { total, active } = paramCounts({ shared: 2, expert: 1, E, k: kk });
    const sizes = Array.from({ length: E }, () => 1);
    assert.equal(total, 2 + sizes.reduce((a, b) => a + b, 0));
    assert.equal(active, 2 + sizes.slice(0, kk).reduce((a, b) => a + b, 0));
  }
});

test("more experts at fixed k: total grows, active stays put", () => {
  const rows = [4, 8, 16, 32].map(E => paramCounts({ shared: 5, expert: 3, E, k: 2 }));
  rows.slice(1).forEach((r, i) => { assert.ok(r.total > rows[i].total); assert.equal(r.active, rows[i].active); assert.ok(r.expertShare < rows[i].expertShare); });
});

test("uniform load drops nothing, and a one-expert load drops the overflow", () => {
  const E = 8, uniform = Array.from({ length: 64 }, (_, i) => i % E);
  assert.equal(capacityRun(uniform, E, 1).dropped, 0);
  const all = capacityRun(Array(64).fill(3), E, 1.25);
  assert.equal(all.dropped, 64 - all.capacity);
});

test("a higher capacity factor never drops more, for the untrained skewed router", () => {
  for (const seed of SEEDS) {
    const { xs } = makeTokens(seed), R = initRouter(seed + 1);
    const drops = [1, 1.25, 1.5, 2, 8].map(f => stats(R, xs, 8, f).dropped);
    assert.ok(drops[0] > 0);
    drops.slice(1, 4).forEach((d, i) => assert.ok(d < drops[i], drops.join()));
    assert.equal(drops.at(-1), 0);
    const spare = f => { const r = stats(R, xs, 8, f); return r.load.reduce((s, l) => s + Math.max(0, r.capacity - l), 0); };
    assert.ok(spare(2) > spare(1.25) && spare(1.25) > 0); // a bigger factor reserves slots that go unused
  }
});

test("the seeded skewed router drops tokens at capacity factor 1.25", () => {
  for (const seed of SEEDS) {
    const { xs } = makeTokens(seed), s = stats(initRouter(seed + 1), xs, 8, 1.25);
    assert.ok(s.dropped > 0);
    assert.equal(s.load.reduce((a, b) => a + b, 0), xs.length);
  }
});

test("aux loss: 1 for uniform routing, E when everything goes to one expert", () => {
  for (const E of [2, 4, 8, 16]) {
    const uniform = Array(E).fill(1 / E), one = Array.from({ length: E }, (_, i) => +(i === 0));
    close(auxLoss(uniform, uniform), 1);
    close(auxLoss(one, one), E);
  }
});

test("aux loss rises as routing slides from uniform to one expert", () => {
  const E = 8, uniform = Array(E).fill(1 / E), one = Array.from({ length: E }, (_, i) => +(i === 0));
  const losses = [0, 0.25, 0.5, 0.75, 1].map(t => { const v = uniform.map((u, i) => (1 - t) * u + t * one[i]); return auxLoss(v, v); });
  losses.slice(1).forEach((l, i) => assert.ok(l > losses[i]));
});

test("the page's run (seed 1, weight 10) lowers the busiest share and stays at 0 dropped from step 330", () => {
  const h = train({ seed: 1, ...TRAIN }).history;
  assert.ok(h[0].dropped > 0 && h[0].busiest > h.at(-1).busiest && h.at(-1).aux < h[0].aux);
  h.slice(330).forEach(s => assert.equal(s.dropped, 0));
});

test("over 30 seeds, weight 10 drops far fewer tokens than no aux loss", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const mean = (alpha, key) => seeds.reduce((s, seed) => s + train({ seed, ...TRAIN, alpha }).history.at(-1)[key], 0) / seeds.length;
  assert.ok(mean(10, "dropped") < 3 && mean(0, "dropped") > 15);
  assert.ok(mean(10, "busiest") < 0.2 && mean(0, "busiest") > 0.25);
});

test("without the aux loss, tokens are still dropped after the same steps on the page's seed", () => {
  const last = train({ seed: 1, ...TRAIN, alpha: 0 }).history.at(-1);
  assert.ok(last.dropped > 0);
});

test("a stronger aux weight balances better, averaged over seeds", () => {
  const mean = alpha => SEEDS.reduce((s, seed) => s + train({ seed, ...TRAIN, alpha }).history.at(-1).dropped, 0) / SEEDS.length;
  const d = [0, 1, 3, 10].map(mean);
  d.slice(1).forEach((v, i) => assert.ok(v < d[i], d.join()));
});
