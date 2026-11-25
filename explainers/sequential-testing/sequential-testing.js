// Sequential A/B tests: the logic, with no DOM, so it can be tested in Node.
// The model counts conversions only. Each one is the treatment's with probability p;
// the walk is T - C (treatment minus control conversions). Exact results come from a
// dynamic program over that difference, one conversion at a time.
import { quantile } from "../../shared/normal.js";
import { mulberry } from "../../shared/random.js";

export const N = 808;
export const ALPHA = 0.05;
export const Z = quantile(1 - ALPHA); // 1.645
export const D = Math.ceil(2 * Math.sqrt(N)); // stop threshold for T - C: 57
export const LIFTS = { none: 0, 20: 0.2, 50: 0.5 };

/** Chance a conversion is the treatment's: 1/2 with no difference, (1 + L) / (2 + L) with lift L. */
export const share = lift => (1 + lift) / (2 + lift);

/** Stop rule: win when T - C reaches the threshold; the check after conversion n. */
export const ruleWins = (n, diff) => diff >= D;
/** Peeking: win when the one-sided z-test, (T - C) / sqrt(n), is above Z. */
export const peekWins = (n, diff) => diff / Math.sqrt(n) > Z;

/**
 * Exact results for any stopping test by dynamic program: `wins(n, diff)` is checked after each
 * conversion up to N, and the run stops at the first win. Returns the chance of a win, the mean
 * number of conversions at which it stops (N when it never wins), and the chance of stopping by n.
 */
export function exact(wins, lift = 0) {
  const p = share(lift), dist = new Map([[0, 1]]);
  let win = 0, mean = 0;
  const byN = [0];
  for (let n = 1; n <= N; n++) {
    const next = new Map();
    for (const [d, pr] of dist) for (const [nd, q] of [[d + 1, p], [d - 1, 1 - p]]) {
      if (wins(n, nd)) { win += pr * q; mean += pr * q * n; } else next.set(nd, (next.get(nd) || 0) + pr * q);
    }
    dist.clear(); for (const [k, v] of next) dist.set(k, v);
    byN.push(win);
  }
  for (const pr of dist.values()) mean += pr * N;
  return { win, mean, byN };
}

/** A single test at conversion N: P(z > Z), exact binomial. */
export function singleTest(lift = 0) {
  const p = share(lift);
  let win = 0;
  const logs = [0]; // log of C(N, t), built up one factor at a time
  for (let t = 1; t <= N; t++) logs.push(logs[t - 1] + Math.log((N - t + 1) / t));
  for (let t = 0; t <= N; t++) if (peekWins(N, 2 * t - N)) win += Math.exp(logs[t] + t * Math.log(p) + (N - t) * Math.log(1 - p));
  return { win };
}

/** One seeded run: the walk T - C up to the stop (or N), and whether the test won. */
export function walk(wins, lift, seed) {
  const p = share(lift), rnd = mulberry(seed), path = [0];
  let diff = 0;
  for (let n = 1; n <= N; n++) {
    diff += rnd() < p ? 1 : -1; path.push(diff);
    if (wins(n, diff)) return { path, won: true, stop: n };
  }
  return { path, won: false, stop: N };
}

export const MODES = { rule: "Stop rule", peek: "Peeking" };
export const LIFT_LABELS = { none: "No difference", 20: "20% lift", 50: "50% lift" };
const TESTS = { rule: ruleWins, peek: peekWins };
const cache = {};
/** Exact results for a mode and lift key, computed once. */
export const results = (mode, lift) => cache[mode + lift] ||= exact(TESTS[mode], LIFTS[lift]);
const single = {};
const pct = x => x > 0.999 ? ">99.9%" : (x * 100).toFixed(1) + "%";
export { pct };

/** Everything the page shows for a mode, a lift key and a seed: the run, the boundary, the tiles and the status line. */
export function view(mode, lift, seed) {
  const kind = lift === "none" ? "false winners" : "winners found";
  const run = walk(TESTS[mode], LIFTS[lift], seed);
  const boundary = mode === "rule" ? [[0, D], [N, D]] : Array.from({ length: N / 8 + 1 }, (_, i) => [Math.max(1, i * 8), Z * Math.sqrt(Math.max(1, i * 8))]);
  const one = single[lift] ||= singleTest(LIFTS[lift]).win;
  const stats = [
    [pct(results("rule", lift).win), `${kind}, stop rule`],
    [pct(results("peek", lift).win), `${kind}, peeking`],
    [pct(one), `${kind}, one test at ${N}`],
    [Math.round(results(mode, lift).mean), `mean stop, ${MODES[mode].toLowerCase()}`],
    [run.won ? `winner at ${run.stop}` : "no winner", `this run, ${MODES[mode].toLowerCase()}`],
  ];
  const status = run.won ? `${MODES[mode]} declares a winner after ${run.stop} conversions.` : `${MODES[mode]} reaches ${N} conversions with no winner.`;
  return { run, boundary, stats, status };
}
