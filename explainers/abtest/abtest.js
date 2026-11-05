// Two-proportion z-tests, sample-size planning and the "peeking" problem. No DOM.
import { mulberry } from "../../shared/random.js";

// Abramowitz–Stegun 7.1.26 erf approximation (|error| < 1.5e-7)
export function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
export function normInv(p) { // bisection is plenty here
  let lo = -10, hi = 10; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2;
}

export function zTest(xA, nA, xB, nB) {
  if (!nA || !nB) return { z: 0, p: 1, diff: 0 };
  const pA = xA / nA, pB = xB / nB, pool = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
  const z = se ? (pB - pA) / se : 0;
  return { z, p: 2 * (1 - normCdf(Math.abs(z))), diff: pB - pA, pA, pB };
}
export function ci95(x, n) { if (!n) return [0, 1]; const p = x / n, h = 1.96 * Math.sqrt(p * (1 - p) / n); return [Math.max(0, p - h), Math.min(1, p + h)]; }

/** Visitors per arm to detect an absolute change of `delta` from baseline p with given alpha/power (two-sided). */
export function sampleSize(p, delta, alpha = 0.05, power = 0.8) {
  const za = normInv(1 - alpha / 2), zb = normInv(power), p2 = p + delta, pb = (p + p2) / 2;
  return Math.ceil(((za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p * (1 - p) + p2 * (1 - p2))) ** 2) / (delta * delta));
}

/** One experiment's running tally, checked every `every` visitors per arm. */
export function run({ pA, pB, n, every = 50, seed = 1 }) {
  const r = mulberry(seed); let xA = 0, xB = 0; const checks = [];
  for (let i = 1; i <= n; i++) { if (r() < pA) xA++; if (r() < pB) xB++; if (i % every === 0 || i === n) checks.push({ n: i, xA, xB, ...zTest(xA, i, xB, i) }); }
  return checks;
}

/** Share of experiments declared "significant": checking only at the end vs stopping at the first peek with p < alpha. */
export function peekingRates({ pA, pB, n, every, trials = 400, alpha = 0.05, seed = 7 }) {
  let fixed = 0, peeking = 0;
  for (let t = 0; t < trials; t++) {
    const c = run({ pA, pB, n, every, seed: seed * 1000 + t });
    if (c.at(-1).p < alpha) fixed++;
    if (c.some(k => k.p < alpha)) peeking++;
  }
  return { fixed: fixed / trials, peeking: peeking / trials };
}
