// Recommendation by matrix factorisation: learn a small vector per user and per item so their dot product ≈ rating. No DOM.
import { mulberry } from "./autograd.js";

export const ITEMS = [
  { name: "Starfall Run", g: [1, 0] }, { name: "Orbit Nine", g: [1, 0] }, { name: "Laser Tide", g: [0.9, 0.1] },
  { name: "Quiet Orchard", g: [0, 1] }, { name: "Letters Home", g: [0.1, 0.9] }, { name: "The Long Summer", g: [0, 1] },
  { name: "Robot Kitchen", g: [0.6, 0.6] }, { name: "Midnight Ferry", g: [0.5, 0.5] },
];
export const USERS = ["Ana", "Bo", "Cy", "Dee", "Eli", "Fay", "Gus", "Hal"];

/** Synthetic ratings: each user has a taste for "sci-fi" vs "drama"; some ratings hidden. */
export function makeRatings(seed = 1, observed = 0.55) {
  const r = mulberry(seed), taste = USERS.map((_, i) => (i < 3 ? [1, 0.1] : i < 6 ? [0.1, 1] : [0.6, 0.6]));
  const R = USERS.map((_, u) => ITEMS.map(it => Math.max(1, Math.min(5, Math.round(1 + 4 * (taste[u][0] * it.g[0] + taste[u][1] * it.g[1]) + (r() - 0.5))))));
  const mask = R.map(row => row.map(() => r() < observed));
  mask.forEach((row, u) => { if (!row.some(Boolean)) row[0] = true; });
  return { R, mask };
}

export class MF {
  constructor(nu, ni, k = 2, seed = 1) {
    const r = mulberry(seed); this.k = k;
    this.P = Array.from({ length: nu }, () => Array.from({ length: k }, () => (r() - 0.5) * 0.4));
    this.Q = Array.from({ length: ni }, () => Array.from({ length: k }, () => (r() - 0.5) * 0.4));
    this.bu = new Array(nu).fill(0); this.bi = new Array(ni).fill(0); this.mu = 3;
  }
  predict(u, i) { let s = this.mu + this.bu[u] + this.bi[i]; for (let f = 0; f < this.k; f++) s += this.P[u][f] * this.Q[i][f]; return s; }
  /** One pass of SGD over observed ratings. */
  epoch(R, mask, lr = 0.03, reg = 0.05) {
    let se = 0, n = 0;
    for (let u = 0; u < R.length; u++) for (let i = 0; i < R[0].length; i++) if (mask[u][i]) {
      const e = R[u][i] - this.predict(u, i); se += e * e; n++;
      this.bu[u] += lr * (e - reg * this.bu[u]); this.bi[i] += lr * (e - reg * this.bi[i]);
      for (let f = 0; f < this.k; f++) { const p = this.P[u][f], q = this.Q[i][f]; this.P[u][f] += lr * (e * q - reg * p); this.Q[i][f] += lr * (e * p - reg * q); }
    }
    return Math.sqrt(se / n);
  }
  fit(R, mask, epochs = 300) { const obs = []; for (const row of mask.map((m, u) => m.map((x, i) => x ? R[u][i] : null))) for (const v of row) if (v != null) obs.push(v); this.mu = obs.reduce((a, b) => a + b, 0) / obs.length; let e; for (let t = 0; t < epochs; t++) e = this.epoch(R, mask); return e; }
}

export function heldOutRMSE(R, mask, predict) { let se = 0, n = 0; for (let u = 0; u < R.length; u++) for (let i = 0; i < R[0].length; i++) if (!mask[u][i]) { se += (R[u][i] - predict(u, i)) ** 2; n++; } return n ? Math.sqrt(se / n) : 0; }
