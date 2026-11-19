// Multi-armed bandits: the logic, with no DOM, so it can be tested in Node.
import { mulberry, gaussian } from "../../shared/random.js";
import { quantile } from "../../shared/normal.js";

export const RATES = [0.10, 0.12], VISITORS = 10000, RUNS = 200;

/** Beta(1,1) prior plus wins and losses gives Beta(1+wins, 1+losses). */
export const betaPosterior = (wins, visits) => ({ a: 1 + wins, b: 1 + visits - wins });
export const betaMean = ({ a, b }) => a / (a + b);

/** Expected conversions lost against always showing the better arm, for a given visit split. */
export const expectedRegret = (visits, rates = RATES) => visits.reduce((s, v, i) => s + v * (Math.max(...rates) - rates[i]), 0);

/** Gamma(shape) draw, Marsaglia–Tsang; shape >= 1 only (all posteriors here have a, b >= 1). */
function gamma(shape, rnd) {
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = gaussian(rnd), v = (1 + c * x) ** 3;
    if (v > 0 && Math.log(1 - rnd()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
/** Beta(a, b) draw from two gamma draws. */
export function betaSample({ a, b }, rnd) { const x = gamma(a, rnd), y = gamma(b, rnd); return x / (x + y); }

/** 95% normal-approximation interval for a conversion rate. */
export function interval(wins, visits) {
  const p = wins / visits, h = quantile(0.975) * Math.sqrt(p * (1 - p) / visits);
  return { lo: p - h, hi: p + h, width: 2 * h };
}

/** One run. policy: "split" (alternate), "greedy" (higher observed rate, after one visit to each arm) or "thompson".
 *  Returns visits, wins and the arm chosen for each visitor. */
export function run(policy, seed, visitors = VISITORS, rates = RATES) {
  const rnd = mulberry(seed), visits = rates.map(() => 0), wins = rates.map(() => 0), choices = [];
  for (let t = 0; t < visitors; t++) {
    let arm;
    if (policy === "split") arm = t % rates.length;
    else if (policy === "greedy") arm = t < rates.length ? t : wins.map((w, i) => w / visits[i]).reduce((best, r, i, all) => r > all[best] ? i : best, 0);
    else { const s = rates.map((_, i) => betaSample(betaPosterior(wins[i], visits[i]), rnd)); arm = s.reduce((best, x, i) => x > s[best] ? i : best, 0); }
    visits[arm]++; choices.push(arm);
    if (rnd() < rates[arm]) wins[arm]++;
  }
  return { policy, seed, visits, wins, choices, regret: expectedRegret(visits, rates) };
}

/** Share of visitors in choices[from, to) shown arm `arm`. */
export const share = (choices, from, to, arm = 1) => choices.slice(from, to).filter(c => c === arm).length / (to - from);

/** RUNS seeded runs (seeds 1..RUNS): mean regret and how many runs sent most traffic to the worse arm. */
export function summarize(policy, runs = RUNS) {
  let regret = 0, stuck = 0;
  for (let s = 1; s <= runs; s++) { const r = run(policy, s); regret += r.regret; if (r.visits[0] > r.visits[1]) stuck++; }
  return { policy, meanRegret: regret / runs, stuck };
}
