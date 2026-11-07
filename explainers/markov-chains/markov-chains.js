// Markov chains: tomorrow depends only on today. Weather with three states, a transition matrix, and its long run. No DOM.

export const STATES = ["sunny", "cloudy", "rainy"];
/** P[i][j]: chance that state i is followed by state j. */
export const WEATHER = [[0.7, 0.2, 0.1], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]];

export const step = (dist, P) => dist.map((_, j) => dist.reduce((s, p, i) => s + p * P[i][j], 0));
/** The distribution after each of n days, starting from `start`. */
export function evolve(start, P, n) { const out = [start]; for (let t = 0; t < n; t++) out.push(step(out.at(-1), P)); return out; }
/** Stationary distribution π with π P = π, by repeated steps from a uniform start. */
export function stationary(P, iters = 500) { let d = P.map(() => 1 / P.length); for (let t = 0; t < iters; t++) d = step(d, P); return d; }

/** A random walk of n days, and how often each state came up. */
export function walk(P, start, n, rnd) {
  const days = [start], counts = P.map(() => 0); counts[start]++;
  for (let t = 1; t < n; t++) { const row = P[days.at(-1)]; let r = rnd(), j = 0; while (j < row.length - 1 && r >= row[j]) r -= row[j++]; days.push(j); counts[j]++; }
  return { days, freq: counts.map(c => c / n) };
}
/** Set one probability and rescale the rest of its row so it still sums to 1. */
export function setProb(P, i, j, v) {
  const row = P[i], rest = 1 - row[j], out = P.map(r => [...r]);
  out[i] = row.map((x, k) => (k === j ? v : rest ? x * (1 - v) / rest : (1 - v) / (row.length - 1)));
  return out;
}
