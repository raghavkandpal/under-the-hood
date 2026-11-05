// How a database chooses between a full table scan and an index, from estimated row counts. No DOM.
// Cost units follow Postgres's defaults: reading a page sequentially = 1, at random = 4, handling a row = 0.01.

export const DEFAULTS = { rows: 1_000_000, rowsPerPage: 100, seqPage: 1, randomPage: 4, cpuRow: 0.01, indexHeight: 3 };

/** Full scan: read every page in order, check every row. */
export function seqCost(o = DEFAULTS) { return (o.rows / o.rowsPerPage) * o.seqPage + o.rows * o.cpuRow; }

/** Index scan: walk the B-tree, then fetch each matching row. Unclustered: one random page per row (capped at all pages).
 *  Clustered (table stored in index order): matching rows sit together, so pages are read sequentially. */
export function indexCost(matching, o = DEFAULTS, clustered = false) {
  const pages = o.rows / o.rowsPerPage;
  const fetch = clustered ? Math.ceil(matching / o.rowsPerPage) * o.seqPage : Math.min(matching, pages * 3) * o.randomPage;
  return o.indexHeight * o.randomPage + fetch + matching * o.cpuRow * 2;
}

export function choosePlan(estimatedRows, o = DEFAULTS, clustered = false) {
  const s = seqCost(o), i = indexCost(estimatedRows, o, clustered);
  return { plan: i < s ? "index" : "seq", seq: s, index: i };
}

/** Selectivity where the two plans cost the same (search over row counts). */
export function crossover(o = DEFAULTS, clustered = false) {
  let lo = 0, hi = o.rows; const s = seqCost(o);
  if (indexCost(hi, o, clustered) < s) return 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (indexCost(m, o, clustered) < s) lo = m; else hi = m; }
  return lo / o.rows;
}

/** Synthetic prices: most products cheap, a long tail of expensive ones. `sale` cuts a quarter of items to a quarter of their price. */
export function prices(n, rnd, { sale = false } = {}) {
  const cents = v => Math.max(0.01, Math.round(v * 100) / 100);
  return Array.from({ length: n }, () => { let p = Math.exp(2 + rnd() * 2.5 + rnd() * 1.5); if (sale && rnd() < 0.25) p /= 4; return cents(p); });
}

/** Equi-depth histogram: bucket boundaries with the same number of rows in each, as databases keep in their statistics. */
export function histogram(values, buckets = 20) { const s = [...values].sort((a, b) => a - b); return Array.from({ length: buckets + 1 }, (_, i) => s[Math.min(s.length - 1, Math.floor(i * (s.length - 1) / buckets))]); }

/** Estimated fraction of rows with value < x, interpolating inside the bucket. */
export function estimateLess(hist, x) {
  const B = hist.length - 1; if (x <= hist[0]) return 0; if (x > hist[B]) return 1;
  for (let i = 0; i < B; i++) if (x <= hist[i + 1]) { const w = hist[i + 1] - hist[i]; return (i + (w ? (x - hist[i]) / w : 1)) / B; }
  return 1;
}
export const actualLess = (values, x) => values.filter(v => v < x).length / values.length;
