// KV cache for transformer decoding: reuse past keys/values instead of recomputing them. No DOM.

/** Toy single-head causal attention over vectors xs (each a number[] of size d). Projections are fixed simple maps. */
const proj = (x, s) => x.map((v, i) => v * (1 + 0.1 * ((i + s) % 3)) + 0.05 * s);
export const K = x => proj(x, 1), V = x => proj(x, 2), Q = x => proj(x, 3);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function attend(q, keys, vals) {
  const sc = keys.map(k => dot(q, k) / Math.sqrt(q.length)), m = Math.max(...sc), w = sc.map(s => Math.exp(s - m)), z = w.reduce((a, b) => a + b, 0);
  return vals[0].map((_, j) => vals.reduce((s, v, i) => s + (w[i] / z) * v[j], 0));
}

/** Output for the newest token, recomputing every key and value from scratch. Returns { out, kvComputed }. */
export function stepNoCache(xs) {
  const keys = xs.map(K), vals = xs.map(V);
  return { out: attend(Q(xs.at(-1)), keys, vals), kvComputed: xs.length };
}

/** Same, but keys/values of earlier tokens come from the cache; only the new token's are computed. */
export function stepCached(cache, x) {
  cache.keys.push(K(x)); cache.vals.push(V(x));
  return { out: attend(Q(x), cache.keys, cache.vals), kvComputed: 1 };
}

/** Total K/V projections to generate n tokens after a prompt of p tokens. */
export function work(p, n, cached) {
  if (cached) return p + n; // prefill p once, then 1 per new token
  let s = 0; for (let t = p; t < p + n; t++) s += t + 1; return s; // recompute the whole prefix every step
}

/** Bytes of KV cache: 2 (K and V) × layers × kvHeads × headDim × tokens × bytesPerValue. */
export const cacheBytes = ({ layers, kvHeads, headDim }, tokens, bytes = 2) => 2 * layers * kvHeads * headDim * tokens * bytes;

/** Illustrative model shapes (typical of their size class, not any specific product). */
export const SHAPES = {
  small: { name: "~8B, grouped-query attention", layers: 32, kvHeads: 8, headDim: 128 },
  smallMHA: { name: "~8B, full multi-head attention", layers: 32, kvHeads: 32, headDim: 128 },
  large: { name: "~70B, grouped-query attention", layers: 80, kvHeads: 8, headDim: 128 },
};
