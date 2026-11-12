// Mixture of experts: top-k routing, capacity and the Switch auxiliary loss on toy 2-D tokens. No DOM.
import { mulberry, gaussian } from "../../shared/random.js";

export const softmax = xs => { const m = Math.max(...xs), e = xs.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };

/** Softmax over expert scores, keep the top k, renormalise. Returns { probs, weights, chosen }. */
export function route(scores, k) {
  const probs = softmax(scores);
  const chosen = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k).map(x => x[1]);
  const kept = chosen.reduce((s, i) => s + probs[i], 0);
  return { probs, chosen, weights: probs.map((p, i) => (chosen.includes(i) ? p / kept : 0)) };
}

/** Parameters: shared (attention, embeddings) plus E experts of `expert` each; k of them run per token. */
export function paramCounts({ shared, expert, E, k }) {
  let total = shared, active = shared;
  for (let e = 0; e < E; e++) { total += expert; if (e < k) active += expert; }
  return { total, active, expertShare: k / E };
}

/** Tokens per expert (top-1) kept in arrival order up to capacity = factor × tokens / E. */
export function capacityRun(assign, E, factor) {
  const capacity = Math.ceil(factor * assign.length / E), load = Array(E).fill(0), kept = Array(E).fill(0);
  for (const e of assign) { load[e]++; if (kept[e] < capacity) kept[e]++; }
  return { capacity, load, dropped: load.reduce((s, l) => s + Math.max(0, l - capacity), 0) };
}

/** Switch aux loss E·Σ fᵢ·Pᵢ: f = share of tokens sent to i, P = mean router probability for i. */
export function auxLoss(f, P) { return f.length * f.reduce((s, fi, i) => s + fi * P[i], 0); }

/** Seeded tokens: cluster centres on a circle, clusters of unequal size, and each cluster's preferred expert. */
export function makeTokens(seed, n = 128, E = 8) {
  const rnd = mulberry(seed), weights = [0.26, 0.18, 0.15, 0.12, 0.1, 0.08, 0.07, 0.04].slice(0, E);
  const xs = [], best = [];
  for (let t = 0; t < n; t++) {
    let r = rnd(), c = 0;
    while (c < E - 1 && r >= weights[c]) { r -= weights[c]; c++; }
    const a = (2 * Math.PI * c) / E;
    xs.push([2 * Math.cos(a) + 0.5 * gaussian(rnd), 2 * Math.sin(a) + 0.5 * gaussian(rnd)]);
    best.push(c);
  }
  return { xs, best };
}

/** Router: logits = W·x + b. Starts near-zero but with a seeded bias that favours expert 0. */
export function initRouter(seed, E = 8) {
  const rnd = mulberry(seed);
  return { W: Array.from({ length: E }, () => [0.1 * gaussian(rnd), 0.1 * gaussian(rnd)]), b: Array.from({ length: E }, (_, i) => (i === 0 ? 0.5 : 0)) };
}
const logits = (R, x) => R.W.map((w, e) => w[0] * x[0] + w[1] * x[1] + R.b[e]);

/** Top-1 load stats for a router on tokens. */
export function stats(R, xs, E, factor) {
  const probs = xs.map(x => softmax(logits(R, x))), assign = probs.map(p => p.indexOf(Math.max(...p)));
  const f = Array(E).fill(0), P = Array(E).fill(0);
  assign.forEach(e => f[e]++); probs.forEach(p => p.forEach((v, e) => (P[e] += v)));
  f.forEach((_, e) => { f[e] /= xs.length; P[e] /= xs.length; });
  return { f, P, assign, aux: auxLoss(f, P), ...capacityRun(assign, E, factor), busiest: Math.max(...f) };
}

/** Gradient descent on the router. Task loss: cross-entropy towards each token's preferred expert. alpha scales the aux loss. */
export function train({ seed = 1, n = 128, E = 8, steps = 200, alpha = 0, lr = 0.5, factor = 1.25 } = {}) {
  const { xs, best } = makeTokens(seed, n, E), R = initRouter(seed + 1, E), history = [stats(R, xs, E, factor)];
  for (let s = 0; s < steps; s++) {
    const probs = xs.map(x => softmax(logits(R, x))), cur = history[history.length - 1];
    const dot = probs.map(p => p.reduce((a, pi, i) => a + E * cur.f[i] * pi, 0)); // Σᵢ E fᵢ pᵢ per token
    const gW = R.W.map(() => [0, 0]), gb = Array(E).fill(0);
    probs.forEach((p, t) => p.forEach((pe, e) => {
      const g = (pe - (best[t] === e ? 1 : 0)) / n + (alpha * pe * (E * cur.f[e] - dot[t])) / n;
      gW[e][0] += g * xs[t][0]; gW[e][1] += g * xs[t][1]; gb[e] += g;
    }));
    R.W.forEach((w, e) => { w[0] -= lr * gW[e][0]; w[1] -= lr * gW[e][1]; R.b[e] -= lr * gb[e]; });
    history.push(stats(R, xs, E, factor));
  }
  return { history, router: R, xs, best };
}
