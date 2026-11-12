// Learning from human feedback on a toy: six canned replies, a Bradley–Terry reward model, the KL-regularised optimum. No DOM.
import { mulberry } from "../../shared/random.js";

const words = t => t.split(/\s+/).length;
// One prompt, "What is a mutex?". `q` is the hidden true quality (0..1); the reward model never sees it, only `cue`,
// a noisy proxy for it. The second feature is length in words (/ 50).
const RAW = [
  ["A lock.", 0.1, 0.2],
  ["A mutex lets one thread at a time enter a critical section; the rest wait.", 0.9, 0.85],
  ["A mutex is a lock around shared data: lock it, touch the data, unlock it, and other threads wait their turn.", 1, 0.9],
  ["A mutex, short for mutual exclusion, is a lock. A thread takes it before it touches shared data and gives it back afterwards, so only one thread is ever inside that section while the others wait for it to be free again.", 0.5, 0.8],
  ["Great question! There is a lot to say about this topic. A mutex, which is short for mutual exclusion, is a kind of lock, and locks are used in many programs. In general, a program may have several threads, and a mutex can be used with them in many different ways and settings.", 0.3, 0.45],
  ["Mutexes are a broad and fascinating subject, and it is hard to know where to begin. Many people have written about locks, threads, programs, computers, shared data and critical sections over the years, and there are many views, so the best answer depends on a number of things that we could talk about at length if you like, in as much detail as you would want.", 0.1, 0.3],
];
export const REPLIES = RAW.map(([text, q, cue]) => ({ text, q, cue, len: words(text) / 50 }));
export const N = REPLIES.length;
/** The base model's probabilities over the replies: it most often says the two-word "A lock." and rarely the best replies. */
export const PI_REF = [0.45, 0.1, 0.1, 0.1, 0.15, 0.1];

/** How strongly raters follow true quality, and how much they favour length on top of it. */
export const RATER = { quality: 6, lengthBias: 8 };

export const sigmoid = x => 1 / (1 + Math.exp(-x));
/** Bradley–Terry: the chance A is preferred to B given their rewards. */
export const bradleyTerry = (rA, rB) => sigmoid(rA - rB);

/** n seeded preference pairs {a, b, win} (win = 1 when A was preferred) from the noisy rater. */
export function makePairs(seed, n) {
  const rnd = mulberry(seed), out = [];
  while (out.length < n) {
    const a = Math.floor(rnd() * N), b = Math.floor(rnd() * N);
    if (a === b) continue;
    const p = bradleyTerry(RATER.quality * REPLIES[a].q + RATER.lengthBias * REPLIES[a].len, RATER.quality * REPLIES[b].q + RATER.lengthBias * REPLIES[b].len);
    out.push({ a, b, win: rnd() < p ? 1 : 0 });
  }
  return out;
}

const feat = i => [REPLIES[i].cue, REPLIES[i].len];
const reward = (w, i) => w[0] * feat(i)[0] + w[1] * feat(i)[1];
export const rewards = w => REPLIES.map((_, i) => reward(w, i));

/** Fit w by gradient descent on the Bradley–Terry log-loss: maximise Σ log P(winner beats loser). */
export function trainReward(pairs, { steps = 400, lr = 0.5 } = {}) {
  const w = [0, 0];
  for (let s = 0; s < steps; s++) {
    const g = [0, 0];
    for (const { a, b, win } of pairs) {
      const err = win - bradleyTerry(reward(w, a), reward(w, b));
      for (let j = 0; j < 2; j++) g[j] += err * (feat(a)[j] - feat(b)[j]);
    }
    for (let j = 0; j < 2; j++) w[j] += lr * g[j] / Math.max(1, pairs.length); // no pairs: stay at 0
  }
  return w;
}

/** Share of pairs where the reward model puts the preferred reply higher. */
export const pairAccuracy = (w, pairs) => pairs.filter(({ a, b, win }) => (reward(w, a) > reward(w, b)) === (win === 1)).length / pairs.length;

/** The exact optimum of E[r] − β·KL(π‖π_ref): π*(y) ∝ π_ref(y)·exp(r(y)/β). */
export function optimalPolicy(piRef, r, beta) {
  const z = r.map((v, i) => Math.log(piRef[i]) + v / beta), m = Math.max(...z), e = z.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}
export const kl = (p, q) => p.reduce((s, v, i) => (v > 0 ? s + v * Math.log(v / q[i]) : s), 0);
export const expect = (p, v) => p.reduce((s, x, i) => s + x * v[i], 0);
