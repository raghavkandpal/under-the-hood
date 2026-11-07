// Count-min sketch: approximate counts for a huge stream in a small grid of counters. It can only overcount. No DOM.

import { hash } from "../../shared/hash32.js";

/** d rows of w counters. Row r uses its own hash (the item salted with r). */
export function sketch(w, d) { return { w, d, rows: Array.from({ length: d }, () => new Uint32Array(w)), total: 0 }; }
export const cells = (sk, item) => sk.rows.map((_, r) => hash(r + ":" + item) % sk.w);
export function add(sk, item, n = 1) { cells(sk, item).forEach((c, r) => (sk.rows[r][c] += n)); sk.total += n; }
/** The estimate is the smallest of the item's d counters: each one is its true count plus whatever collided with it. */
export const query = (sk, item) => Math.min(...cells(sk, item).map((c, r) => sk.rows[r][c]));

/** With w = ⌈e/ε⌉ and d = ⌈ln(1/δ)⌉, each estimate is within ε × total of the truth with probability at least 1 − δ. */
export const epsilon = w => Math.E / w, delta = d => Math.exp(-d);

/** A skewed stream: item i is picked with weight 1/i^s (a few very popular items, a long tail). */
export function zipfStream({ items, length, s = 1.1, rnd }) {
  const cdf = [], total = Array.from({ length: items }, (_, i) => 1 / (i + 1) ** s).reduce((acc, w, i) => (cdf[i] = acc + w), 0);
  return Array.from({ length }, () => { const r = rnd() * total; let lo = 0, hi = items - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; } return "item-" + (lo + 1); });
}
