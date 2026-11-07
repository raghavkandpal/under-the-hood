// The standard normal distribution.

/** CDF (Abramowitz & Stegun 7.1.26, error < 2e-7). */
export function phi(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
/** Inverse CDF: the z with phi(z) = p, by bisection. */
export function quantile(p) { let lo = -12, hi = 12; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
