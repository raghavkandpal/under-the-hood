// Polynomial ridge regression and train/test error, for the overfitting explainer. No DOM.
import { mulberry } from "../../shared/random.js";

export const TRUTHS = {
  wave: { label: "Wave", f: x => Math.sin(3.4 * x) * 0.8 + 0.2 * x },
  step: { label: "Step", f: x => (x > 0.1 ? 0.7 : -0.5) },
  line: { label: "Straight line", f: x => 0.6 * x - 0.1 },
};

const gauss = rnd => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

export function sample(truth, n, noise, seed) {
  const rnd = mulberry(seed);
  return Array.from({ length: n }, () => { const x = rnd() * 2 - 1; return { x, y: TRUTHS[truth].f(x) + noise * gauss(rnd) }; });
}

// Legendre basis on [-1, 1] keeps high degrees well-conditioned.
export function legendre(x, deg) {
  const P = [1, x];
  for (let n = 1; n < deg; n++) P.push(((2 * n + 1) * x * P[n] - n * P[n - 1]) / (n + 1));
  return P.slice(0, deg + 1);
}

export function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c]; if (Math.abs(d) < 1e-14) continue;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-14 ? 0 : r[n] / r[i]));
}

/** Fit degree-`deg` polynomial with ridge penalty `lambda` (not applied to the constant term). */
export function fit(points, deg, lambda = 0) {
  const k = deg + 1, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  for (const { x, y } of points) {
    const phi = legendre(x, deg);
    for (let i = 0; i < k; i++) { b[i] += phi[i] * y; for (let j = 0; j < k; j++) A[i][j] += phi[i] * phi[j]; }
  }
  for (let i = 1; i < k; i++) A[i][i] += lambda * points.length;
  A[0][0] += 1e-10;
  const w = solve(A, b);
  const predict = x => legendre(x, deg).reduce((s, p, i) => s + p * w[i], 0);
  return { w, predict };
}

export const mse = (model, pts) => pts.reduce((s, p) => s + (model.predict(p.x) - p.y) ** 2, 0) / pts.length;

export function errorCurve(train, test, maxDeg, lambda) {
  return Array.from({ length: maxDeg + 1 }, (_, d) => { const m = fit(train, d, lambda); return { deg: d, train: mse(m, train), test: mse(m, test) }; });
}
