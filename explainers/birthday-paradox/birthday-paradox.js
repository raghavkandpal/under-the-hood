// The birthday paradox: how many people (or hashed items) until two share a value. No DOM.

/** Exact chance that at least two of n items share one of N equally likely values. */
export function collision(n, N) { let none = 1; for (let i = 0; i < n; i++) none *= (N - i) / N; return 1 - none; }
/** The usual approximation 1 − e^(−n(n−1)/2N), good when n ≪ N. */
export const approx = (n, N) => 1 - Math.exp(-n * (n - 1) / (2 * N));
/** Items needed for a chance p of any collision: √(2N ln(1/(1−p))). For p = 50% that's about 1.18 √N. */
export const needed = (N, p) => Math.sqrt(2 * N * Math.log(1 / (1 - p)));
export const half = N => needed(N, 0.5);
/** Pairs among n items. */
export const pairs = n => n * (n - 1) / 2;

/** Simulate `trials` rooms of n people; the share with a shared birthday. */
export function simulate(n, N, trials, rnd) {
  let hit = 0;
  for (let t = 0; t < trials; t++) { const seen = new Set(); for (let i = 0; i < n; i++) { const b = Math.floor(rnd() * N); if (seen.has(b)) { hit++; break; } seen.add(b); } }
  return hit / trials;
}
/** One room: the birthdays and the first shared one, if any. */
export function room(n, N, rnd) {
  const days = Array.from({ length: n }, () => Math.floor(rnd() * N)), seen = new Map();
  for (let i = 0; i < n; i++) { if (seen.has(days[i])) return { days, pair: [seen.get(days[i]), i] }; seen.set(days[i], i); }
  return { days, pair: null };
}
