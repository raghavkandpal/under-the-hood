// Survival curves: Kaplan–Meier with a Greenwood band, and the two common wrong answers. No DOM.
import { quantile } from "../../shared/normal.js";
import { mulberry } from "../../shared/random.js";

/** Ten customers: months until they cancelled (event) or until we last saw them still subscribed (censored). */
export const CUSTOMERS = [[2, 1], [3, 1], [3, 0], [5, 1], [6, 0], [8, 1], [8, 1], [10, 0], [12, 1], [12, 0]].map(([t, event]) => ({ t, event }));
export const MEAN = 12; // the cohort's true mean months to cancel, so S(t) = e^(-t/12)
export const trueS = t => Math.exp(-t / MEAN);

/** Kaplan–Meier steps at each event time: {t, n at risk, d events, S, lo, hi}. Rows tied with an event are still at risk for it. */
export function kaplanMeier(rows, z = quantile(0.975)) {
  const sorted = [...rows].sort((a, b) => a.t - b.t), steps = [];
  let S = 1, g = 0;
  for (let i = 0, d; i < sorted.length; i += d) {
    const t = sorted[i].t;
    let j = i, events = 0;
    while (j < sorted.length && sorted[j].t === t) events += sorted[j++].event;
    d = j - i;
    if (!events) continue;
    const n = sorted.length - i; // everyone from here on, ties included
    S *= 1 - events / n; g += n > events ? events / (n * (n - events)) : 0;
    const se = S * Math.sqrt(g);
    steps.push({ t, n, d: events, S, lo: Math.max(0, S - z * se), hi: Math.min(1, S + z * se) });
  }
  return steps;
}
/** The step function's value at t (1 before the first event). */
export const at = (steps, t) => steps.reduce((s, x) => (x.t <= t ? x.S : s), 1);
/** First event time where S ≤ 0.5, or null if the curve never gets there. */
export const median = steps => steps.find(x => x.S <= 0.5)?.t ?? null;
/** Wrong answer 1: throw away everyone still subscribed, then take the share of the rest who last longer than t. */
export const dropCensored = (rows, t) => { const k = rows.filter(r => r.event); return k.length ? k.filter(r => r.t > t).length / k.length : 1; };
/** Wrong answer 2: treat "last seen" as "cancelled" and take the share who last longer than t. */
export const censoredAsCancelled = (rows, t) => rows.filter(r => r.t > t).length / rows.length;

/** n customers with exponential lifetimes; follow-up times are exponential too, tuned so `censored` of them are still subscribed in expectation. */
export function cohort({ n = 2000, censored = 0.5, seed = 1 } = {}) {
  const rnd = mulberry(seed), c = censored > 0 ? MEAN * (1 - censored) / censored : Infinity, rows = [];
  for (let i = 0; i < n; i++) {
    const life = -MEAN * Math.log(1 - rnd()), follow = -c * Math.log(1 - rnd());
    rows.push(life <= follow ? { t: life, event: 1 } : { t: follow, event: 0 });
  }
  return rows;
}
