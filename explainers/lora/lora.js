// LoRA: instead of updating a whole d × d weight matrix, learn a low-rank update B·A with B (d × r) and A (r × d).
// Here we find the best rank-r update directly (truncated SVD by power iteration) to show what rank buys. No DOM.

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
export const norm = M => Math.sqrt(M.reduce((s, row) => s + row.reduce((t, x) => t + x * x, 0), 0));
export const sub = (A, B) => A.map((row, i) => row.map((x, j) => x - B[i][j]));

/** A "fine-tuning update" made of a few strong directions plus a little noise, like the updates LoRA's paper measured. */
export function targetUpdate({ d = 32, rank = 4, noise = 0.05, rnd }) {
  const M = zeros(d, d);
  for (let k = 0; k < rank; k++) { const u = Array.from({ length: d }, () => gauss(rnd)), v = Array.from({ length: d }, () => gauss(rnd)), s = 1 / (k + 1);
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) M[i][j] += s * u[i] * v[j] / d; }
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) M[i][j] += noise * gauss(rnd) / Math.sqrt(d);
  return M;
}

/** Best rank-r approximation, one singular direction at a time (power iteration with deflation). Returns B·A and the singular values. */
export function lowRank(M, r, iters = 60) {
  const d = M.length, R = M.map(row => [...row]), approx = zeros(d, d), sigmas = [];
  for (let k = 0; k < r; k++) {
    let v = Array.from({ length: d }, (_, i) => Math.sin(i * 7.3 + k * 1.7 + 1));
    for (let t = 0; t < iters; t++) {
      const u = R.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
      v = Array.from({ length: d }, (_, j) => R.reduce((s, row, i) => s + row[j] * u[i], 0));
      const n = Math.hypot(...v); v = v.map(x => x / n);
    }
    const u = R.map(row => row.reduce((s, x, j) => s + x * v[j], 0)), s = Math.hypot(...u);
    sigmas.push(s);
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) { approx[i][j] += u[i] * v[j]; R[i][j] -= u[i] * v[j]; }
  }
  return { approx, sigmas };
}

/** Trainable parameters: full fine-tuning of one d × d matrix vs a rank-r adapter. */
export const params = (d, r) => ({ full: d * d, lora: 2 * d * r });
