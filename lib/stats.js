// Distributions, sampling and confidence intervals for the CLT explainer. No DOM.

export const DISTS = {
  uniform: { label: "Uniform (flat)", mean: 5, sd: 10 / Math.sqrt(12), range: [0, 10], draw: r => r() * 10 },
  skewed: { label: "Skewed (exponential)", mean: 2, sd: 2, range: [0, 14], draw: r => -2 * Math.log(1 - r()) },
  bimodal: { label: "Two humps", mean: 5, sd: Math.sqrt(0.64 + 9), range: [0, 10],
    draw: r => { const g = Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r()) * 0.8; return (r() < 0.5 ? 2 : 8) + g; } },
  dice: { label: "One die", mean: 3.5, sd: Math.sqrt(35 / 12), range: [0.5, 6.5], discrete: true, draw: r => 1 + Math.floor(r() * 6) },
  rare: { label: "Rare event (10% yes)", mean: 0.1, sd: 0.3, range: [-0.5, 1.5], discrete: true, draw: r => (r() < 0.1 ? 1 : 0) },
};

export const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const sampleSd = xs => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };

// two-sided 95% t critical values, df 1..30
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export const tCrit = df => (df <= 30 ? T975[df - 1] : 1.96 + 2.5 / df);

/** 95% CI for the mean using the t distribution. */
export function ci95(xs) {
  const m = mean(xs), se = sampleSd(xs) / Math.sqrt(xs.length), h = tCrit(xs.length - 1) * se;
  return { mean: m, lo: m - h, hi: m + h, se };
}

export function histogram(xs, lo, hi, bins) {
  const counts = Array(bins).fill(0), w = (hi - lo) / bins;
  for (const x of xs) { const b = Math.floor((x - lo) / w); if (b >= 0 && b < bins) counts[b]++; }
  return { counts, w, lo };
}

export const normalPdf = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
