import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry } from "../../shared/random.js";
import { REPLIES, N, PI_REF, RATER, bradleyTerry, makePairs, trainReward, rewards, pairAccuracy, optimalPolicy, kl, expect } from "./rlhf.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const TRUE = REPLIES.map(r => r.q);
const argmax = xs => xs.indexOf(Math.max(...xs));
const BETAS = Array.from({ length: 41 }, (_, i) => 0.05 * 10 ** (i / 10)); // 0.05 .. 500
const fit = (seed, n = 50) => rewards(trainReward(makePairs(seed, n)));

test("there are 6 replies, with a base policy that sums to 1", () => {
  assert.equal(N, 6);
  close(PI_REF.reduce((a, b) => a + b, 0), 1);
  // length is counted from the text, so longer replies really are longer
  const len = REPLIES.map(r => r.text.split(/\s+/).length);
  assert.deepEqual([...len].sort((a, b) => a - b), len);
});

test("Bradley–Terry: equal rewards give 0.5 and a gap of ln 3 gives 0.75", () => {
  close(bradleyTerry(2, 2), 0.5);
  close(bradleyTerry(Math.log(3), 0), 0.75);
  close(bradleyTerry(1.3, -0.4) + bradleyTerry(-0.4, 1.3), 1);
});

test("seeded pairs are reproducible, never pair a reply with itself, and follow the rater", () => {
  assert.deepEqual(makePairs(5, 30), makePairs(5, 30));
  const pairs = makePairs(1, 20000);
  assert.ok(pairs.every(p => p.a !== p.b));
  // longer-and-better beats short-and-bad about as often as Bradley–Terry says
  const score = i => RATER.quality * REPLIES[i].q + RATER.lengthBias * REPLIES[i].len;
  const sel = pairs.filter(p => p.a === 2 && p.b === 0);
  close(mean(sel.map(p => p.win)), bradleyTerry(score(2), score(0)), 0.03);
});

test("the reward model recovers the rater's ordering from 50 pairs, near the label-noise ceiling", () => {
  const rater = REPLIES.map((_, i) => RATER.quality * TRUE[i] + RATER.lengthBias * REPLIES[i].len);
  const held = makePairs(999, 20000);
  const ceiling = held.filter(({ a, b, win }) => (rater[a] > rater[b]) === (win === 1)).length / held.length;
  const accs = SEEDS.map(s => pairAccuracy(trainReward(makePairs(s, 50)), held));
  assert.ok(ceiling > 0.85 && ceiling < 0.87, `ceiling ${ceiling}`);
  assert.ok(mean(accs) > 0.84 && mean(accs) < 0.87, `mean ${mean(accs)}`);
  assert.ok(mean(accs) <= ceiling + 1e-9);
  assert.ok(Math.min(...accs) > 0.8);
});

test("the reward model improves from 2 to 5 to 10 pairs on average, then levels off near the ceiling", () => {
  const held = makePairs(999, 5000), acc = n => mean(SEEDS.map(s => pairAccuracy(trainReward(makePairs(s, n)), held)));
  close(pairAccuracy(trainReward([]), held), 0.5, 0.03); // no pairs: every reward ties, so it is a coin flip
  assert.ok(acc(2) < 0.75 && acc(2) < acc(5) && acc(5) < acc(10) && acc(10) > 0.84, `${acc(2)} ${acc(5)} ${acc(10)}`);
  assert.ok(Math.abs(acc(50) - acc(10)) < 0.02);
});

test("the optimum satisfies π*(y) ∝ π_ref(y)·exp(r/β), is a distribution, and beats random policies on E[r] − β·KL", () => {
  const rnd = mulberry(3), beta = 0.7;
  const r = Array.from({ length: N }, () => 6 * rnd() - 3);
  const star = optimalPolicy(PI_REF, r, beta);
  close(star.reduce((a, b) => a + b, 0), 1);
  for (let i = 1; i < N; i++) close(star[i] / star[0], (PI_REF[i] / PI_REF[0]) * Math.exp((r[i] - r[0]) / beta));
  const J = p => expect(p, r) - beta * kl(p, PI_REF), best = J(star);
  for (let t = 0; t < 2000; t++) {
    const raw = Array.from({ length: N }, () => rnd() + 0.01), s = raw.reduce((a, b) => a + b, 0);
    assert.ok(J(raw.map(v => v / s)) <= best + 1e-12);
  }
  // and the best value is β·log Σ π_ref·exp(r/β)
  close(best, beta * Math.log(PI_REF.reduce((a, p, i) => a + p * Math.exp(r[i] / beta), 0)));
});

test("very large β returns π_ref, very small β puts over 0.99 on the top-reward reply, and KL falls as β rises", () => {
  for (const seed of SEEDS) {
    const r = fit(seed), big = optimalPolicy(PI_REF, r, 1e9), small = optimalPolicy(PI_REF, r, 0.01);
    big.forEach((p, i) => assert.ok(Math.abs(p - PI_REF[i]) < 1e-6));
    assert.ok(small[argmax(r)] > 0.99);
    const kls = BETAS.map(b => kl(optimalPolicy(PI_REF, r, b), PI_REF));
    for (let i = 1; i < kls.length; i++) assert.ok(kls[i] < kls[i - 1], `seed ${seed} at ${BETAS[i]}`);
  }
});

test("the reward model over-rewards length: it learns a positive length weight and ranks the longest reply first", () => {
  for (const seed of SEEDS) {
    const w = trainReward(makePairs(seed, 50)), r = rewards(w);
    assert.ok(w[1] > 1, `length weight ${w[1]}`);
    assert.equal(argmax(r), N - 1);
    assert.ok(TRUE[N - 1] < TRUE[2]); // yet that reply is worse than a concise good one
    assert.ok(r[N - 1] > r[2]);
  }
});

test("reward hacking: proxy reward rises as β falls while the true score falls, with a peak at an intermediate β", () => {
  const refTrue = expect(PI_REF, TRUE);
  for (const seed of SEEDS) {
    const r = fit(seed), at = b => optimalPolicy(PI_REF, r, b);
    const proxy = BETAS.map(b => expect(at(b), r)), truth = BETAS.map(b => expect(at(b), TRUE));
    for (let i = 1; i < BETAS.length; i++) assert.ok(proxy[i] < proxy[i - 1] + 1e-12, "proxy reward is higher at smaller β");
    const i = argmax(truth);
    assert.ok(i > 0 && i < BETAS.length - 1, `seed ${seed}: peak at ${BETAS[i]}`);
    assert.ok(BETAS[i] > 1.9 && BETAS[i] < 5.1, `seed ${seed}: peak at ${BETAS[i]}`);
    assert.ok(truth[i] > 0.355 && truth[i] < 0.415, `seed ${seed}: peak ${truth[i]}`);
    assert.ok(truth[i] > refTrue + 0.02, `seed ${seed}: ${truth[i]} vs ref ${refTrue}`);
    assert.ok(truth[i] > truth[0] + 0.2, `seed ${seed}: beats β→0`);
    assert.ok(truth[0] < refTrue, "β→0 is worse than the base model");
    for (let j = 1; j <= i; j++) assert.ok(truth[j - 1] < truth[j] + 1e-12, "below the peak, the true score falls as β falls");
  }
});

test("seed 3, the run the page shows: peak 0.41 near β = 2, base 0.34, 0.11 at β = 0.05 with 98% on the longest reply", () => {
  const r = fit(3), truth = b => expect(optimalPolicy(PI_REF, r, b), TRUE);
  close(BETAS[16], 1.99, 1e-2);
  close(truth(BETAS[16]), 0.408, 0.005);
  assert.equal(argmax(BETAS.map(truth)), 16);
  close(expect(PI_REF, TRUE), 0.34, 0.005);
  close(truth(BETAS[0]), 0.109, 0.005);
  const p = optimalPolicy(PI_REF, r, BETAS[0])[5];
  assert.ok(p > 0.975 && p < 0.985, `${p}`);
});
