// Monte Carlo: estimating π with darts, and a project-schedule risk simulation. No DOM.
import { mulberry } from "../../shared/random.js";

export function darts(n, seed = 1) {
  const r = mulberry(seed), pts = []; let inside = 0; const trace = [];
  for (let i = 1; i <= n; i++) { const x = r() * 2 - 1, y = r() * 2 - 1, hit = x * x + y * y <= 1; if (hit) inside++; if (i <= 4000) pts.push([x, y, hit]); if ((i & (i - 1)) === 0 || i === n) trace.push({ n: i, est: 4 * inside / i }); }
  return { estimate: 4 * inside / n, pts, trace };
}

/** Triangular distribution sample (min, likely, max). */
export function tri(r, a, m, b) { const u = r(), c = (m - a) / (b - a); return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); }

/** tasks: [{name, min, likely, max}] done one after another; returns sorted totals and the naive "add up the likely values" plan. */
export function project(tasks, runs = 5000, seed = 1) {
  const r = mulberry(seed), totals = new Float64Array(runs);
  for (let k = 0; k < runs; k++) { let t = 0; for (const s of tasks) t += tri(r, s.min, s.likely, s.max); totals[k] = t; }
  totals.sort();
  const plan = tasks.reduce((s, t) => s + t.likely, 0);
  const pct = p => totals[Math.min(runs - 1, Math.floor(p * runs))];
  const pOnTime = d => { let lo = 0, hi = runs; while (lo < hi) { const m = (lo + hi) >> 1; if (totals[m] <= d) lo = m + 1; else hi = m; } return lo / runs; };
  return { totals, plan, p50: pct(0.5), p90: pct(0.9), pOnTime };
}
