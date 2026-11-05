// k-nearest neighbours: classify by majority vote of the k closest labelled points. No DOM.
// points: [{ x: [..], label }]

export const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

/** The k nearest points to q (excluding index `skip`), nearest first. */
export function nearest(points, q, k, skip = -1) {
  return points.map((p, i) => ({ p, i, d: dist(p.x, q) })).filter(o => o.i !== skip).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, k);
}

/** Majority vote; ties go to the label of the closest tied neighbour. weighted: votes count 1/d. */
export function predict(points, q, k, { weighted = false, skip = -1 } = {}) {
  const nb = nearest(points, q, k, skip), votes = new Map();
  for (const o of nb) votes.set(o.p.label, (votes.get(o.p.label) || 0) + (weighted ? 1 / (o.d + 1e-9) : 1));
  let best = null, bv = -1;
  for (const o of nb) { const v = votes.get(o.p.label); if (v > bv) { best = o.p.label; bv = v; } }
  return { label: best, neighbours: nb, confidence: nb.length ? bv / [...votes.values()].reduce((a, b) => a + b, 0) : 0 };
}

/** Leave-one-out accuracy: classify each point using all the others. */
export function looAccuracy(points, k, opts = {}) {
  if (points.length < 2) return 1;
  let ok = 0; points.forEach((p, i) => { if (predict(points, p.x, k, { ...opts, skip: i }).label === p.label) ok++; });
  return ok / points.length;
}

/** Curse of dimensionality: for random points in a unit cube, how much farther is the farthest than the nearest? → 1 as d grows. */
export function contrast(d, n = 200, rnd = Math.random) {
  const pts = Array.from({ length: n }, () => Array.from({ length: d }, rnd)), q = Array.from({ length: d }, rnd);
  const ds = pts.map(p => dist(p, q)); return Math.min(...ds) / Math.max(...ds);
}
