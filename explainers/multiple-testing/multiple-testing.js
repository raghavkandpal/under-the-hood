// Multiple testing: run many tests at p < 0.05 and some "wins" are pure luck. No DOM.

import { phi } from "../../shared/normal.js";

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
/** Two-sided p-value of a z statistic. */
export const pValue = z => 2 * (1 - phi(Math.abs(z)));

/** m tests. A share of them have a real effect (z centred on `effect`); the rest are noise (z centred on 0). */
export function simulate({ m, realShare, effect = 3, rnd }) {
  const nReal = Math.round(m * realShare);
  return Array.from({ length: m }, (_, i) => { const real = i < nReal; return { real, p: pValue((real ? effect : 0) + gauss(rnd)) }; });
}

/** Which p-values count as wins. none: p < α. bonferroni: p < α/m. bh (Benjamini–Hochberg): the largest k with p(k) ≤ kα/m, and everything ranked above it. */
export function decide(ps, method, alpha = 0.05) {
  const m = ps.length;
  if (method === "none") return ps.map(p => p < alpha);
  if (method === "bonferroni") return ps.map(p => p < alpha / m);
  const order = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b]);
  let k = 0; order.forEach((i, r) => { if (ps[i] <= (r + 1) * alpha / m) k = r + 1; });
  const out = new Array(m).fill(false); order.slice(0, k).forEach(i => (out[i] = true)); return out;
}
/** The threshold line each method draws against the p-value of rank r (1-based) out of m. */
export const threshold = (method, r, m, alpha = 0.05) => (method === "none" ? alpha : method === "bonferroni" ? alpha / m : r * alpha / m);

export function score(tests, wins) {
  const t = tests.filter((x, i) => wins[i] && x.real).length, f = tests.filter((x, i) => wins[i] && !x.real).length, real = tests.filter(x => x.real).length;
  return { wins: t + f, trueWins: t, falseWins: f, real, fdp: t + f ? f / (t + f) : 0, power: real ? t / real : 0 };
}

export const METHODS = ["none", "bonferroni", "bh"];
/** Repeat the whole experiment `runs` times. fwer: chance of at least one false win. fdr: average share of wins that are false. power: share of real effects found. */
export function longRun({ m, realShare, runs = 1000, effect = 3, alpha = 0.05, rnd }) {
  const acc = Object.fromEntries(METHODS.map(k => [k, { fwer: 0, fdr: 0, power: 0 }]));
  for (let r = 0; r < runs; r++) {
    const tests = simulate({ m, realShare, effect, rnd }), ps = tests.map(t => t.p);
    for (const k of METHODS) { const s = score(tests, decide(ps, k, alpha)); acc[k].fwer += s.falseWins > 0; acc[k].fdr += s.fdp; acc[k].power += s.power; }
  }
  for (const k of METHODS) for (const f in acc[k]) acc[k][f] /= runs;
  return acc;
}
