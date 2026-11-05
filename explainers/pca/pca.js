// PCA in 2-D with a closed-form eigen-decomposition, plus a generator for stretched, rotated clouds. No DOM.
import { mulberry } from "../../shared/random.js";

export function cloud(n = 150, { spread = 3, thin = 0.6, angle = 0.6, seed = 1 } = {}) {
  const r = mulberry(seed), g = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  const c = Math.cos(angle), s = Math.sin(angle);
  return Array.from({ length: n }, () => { const a = g() * spread, b = g() * thin; return [a * c - b * s, a * s + b * c]; });
}

export function pca2(pts) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  let v1 = Math.abs(sxy) > 1e-12 ? [l1 - syy, sxy] : sxx >= syy ? [1, 0] : [0, 1];
  const L = Math.hypot(...v1); v1 = [v1[0] / L, v1[1] / L];
  const v2 = [-v1[1], v1[0]];
  return { mean: [mx, my], cov: [[sxx, sxy], [sxy, syy]], values: [l1, l2], vectors: [v1, v2], explained: [l1 / tr, l2 / tr] };
}

/** Project onto the first component and back: the best 1-D summary of 2-D data. */
export function reconstruct(pts, model) {
  const [mx, my] = model.mean, [ux, uy] = model.vectors[0];
  return pts.map(([x, y]) => { const t = (x - mx) * ux + (y - my) * uy; return { t, back: [mx + t * ux, my + t * uy] }; });
}
export const reconError = (pts, rec) => pts.reduce((s, p, i) => s + (p[0] - rec[i].back[0]) ** 2 + (p[1] - rec[i].back[1]) ** 2, 0) / pts.length;
