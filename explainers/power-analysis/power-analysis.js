// Statistical power for an A/B test of two conversion rates: how likely the test is to detect a real lift, and how
// many users that takes. Normal approximation for two proportions. No DOM.

import { phi, quantile } from "../../shared/normal.js";

/** Chance a two-sided test at level alpha detects a true lift from p to p + lift, with n users per group. */
export function power({ p, lift, n, alpha = 0.05 }) {
  const p2 = p + lift, pbar = (p + p2) / 2, z = quantile(1 - alpha / 2);
  return phi((Math.abs(lift) - z * Math.sqrt(2 * pbar * (1 - pbar) / n)) / Math.sqrt((p * (1 - p) + p2 * (1 - p2)) / n));
}
/** Users per group for the given power. */
export function sampleSize({ p, lift, power: target = 0.8, alpha = 0.05 }) {
  const p2 = p + lift, pbar = (p + p2) / 2, za = quantile(1 - alpha / 2), zb = quantile(target);
  return Math.ceil((za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p * (1 - p) + p2 * (1 - p2))) ** 2 / lift ** 2);
}

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
/**
 * Run `runs` simulated experiments. Each group's conversion count is drawn from its binomial (normal approximation)
 * and compared with a pooled two-proportion z-test. Returns the share detected and the average lift the winners reported.
 */
export function simulate({ p, lift, n, runs = 1000, alpha = 0.05, rnd }) {
  const za = quantile(1 - alpha / 2), draw = q => Math.max(0, Math.round(n * q + Math.sqrt(n * q * (1 - q)) * gauss(rnd))) / n;
  let hits = 0, liftSum = 0; const observed = [];
  for (let r = 0; r < runs; r++) {
    const a = draw(p), b = draw(p + lift), pool = (a + b) / 2, z = (b - a) / Math.sqrt(2 * pool * (1 - pool) / n), sig = Math.abs(z) > za;
    observed.push({ lift: b - a, sig });
    if (sig && b > a) { hits++; liftSum += b - a; }
  }
  return { detected: hits / runs, liftWhenSignificant: hits ? liftSum / hits : 0, observed };
}
