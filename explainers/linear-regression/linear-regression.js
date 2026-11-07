// Linear regression by least squares: the line that makes the squared vertical misses as small as possible. No DOM.

const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

/** pts: [[x, y]]. slope = cov(x, y) / var(x), and the line passes through the means. */
export function fit(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), mx = mean(xs), my = mean(ys);
  const sxy = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0), sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
  const sse = pts.reduce((s, [x, y]) => s + (y - (intercept + slope * x)) ** 2, 0), sst = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return { slope, intercept, sse, r2: sst ? 1 - sse / sst : 1 };
}
/** Squared error of any line, to compare with the best one. */
export const sse = (pts, slope, intercept) => pts.reduce((s, [x, y]) => s + (y - (intercept + slope * x)) ** 2, 0);

/** Noisy points around y = a + b x. */
export function noisy({ n = 20, a = 2, b = 0.8, noise = 1, rnd }) {
  const g = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  return Array.from({ length: n }, () => { const x = rnd() * 10; return [x, a + b * x + noise * g()]; });
}
