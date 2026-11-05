// The bootstrap: estimate how uncertain a statistic is by resampling your own sample. No DOM.

export const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const STATS = { mean, median };

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
/** Populations with known true mean and median, so we can check whether intervals contain the truth. */
export const POPS = {
  normal: { name: "Heights (bell curve)", draw: rnd => 170 + 8 * gauss(rnd), mean: 170, median: 170 },
  skewed: { name: "Incomes (long right tail)", draw: rnd => 30 * Math.exp(0.9 * gauss(rnd)), mean: 30 * Math.exp(0.405), median: 30 },
  wild: { name: "Startup outcomes (extreme tail)", draw: rnd => 1 * Math.exp(2 * gauss(rnd)), mean: Math.exp(2), median: 1 },
};

export const draw = (pop, n, rnd) => Array.from({ length: n }, () => POPS[pop].draw(rnd));
/** One bootstrap resample: n picks from xs, with replacement. Returns the values and how often each original was picked. */
export function resample(xs, rnd) { const counts = new Array(xs.length).fill(0), out = xs.map(() => { const i = Math.floor(rnd() * xs.length); counts[i]++; return xs[i]; }); return { out, counts }; }
export function bootstrap(xs, stat, B, rnd) { const f = STATS[stat]; return Array.from({ length: B }, () => f(resample(xs, rnd).out)); }
export function percentile(vals, p) { const s = [...vals].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); }
export const ci = (vals, level = 0.95) => [percentile(vals, (1 - level) / 2), percentile(vals, 1 - (1 - level) / 2)];

/** How often does the bootstrap 95% interval contain the true value? (It should be about 95%.) */
export function coverage(pop, n, stat, { trials = 200, B = 400, rnd }) {
  let hit = 0, width = 0; const truth = POPS[pop][stat];
  for (let t = 0; t < trials; t++) { const [lo, hi] = ci(bootstrap(draw(pop, n, rnd), stat, B, rnd)); if (lo <= truth && truth <= hi) hit++; width += hi - lo; }
  return { rate: hit / trials, avgWidth: width / trials };
}
