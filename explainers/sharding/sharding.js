// Sharding: splitting one table's rows across machines by key range or by hash, and what each does to hot spots,
// range scans and adding a shard. Keys are user ids handed out in signup order. No DOM.

import { hash } from "../../shared/hash32.js";

/** Which shard a key lives on. range: equal slices of 0..maxKey. hash: hash(key) mod n. */
export function shardOf(key, { scheme, n, maxKey }) {
  return scheme === "range" ? Math.min(n - 1, Math.floor(key * n / maxKey)) : hash(String(key)) % n;
}

/** Workloads, each a list of keys touched. inserts: new signups get the next ids. reads: any existing user. scan: ids in one range. */
export function workload(kind, { maxKey, ops = 2000, rnd }) {
  if (kind === "inserts") return Array.from({ length: ops }, (_, i) => maxKey - ops + i);
  if (kind === "reads") return Array.from({ length: ops }, () => Math.floor(rnd() * maxKey));
  const from = Math.floor(rnd() * (maxKey - 500)); return Array.from({ length: 500 }, (_, i) => from + i);
}

export function load(keys, opts) {
  const per = new Array(opts.n).fill(0); for (const k of keys) per[shardOf(k, opts)]++;
  return { per, hottest: Math.max(...per) / keys.length, touched: per.filter(Boolean).length };
}
/** Share of keys that live on a different shard after going from n to n + 1 shards (range: split the busiest slice in two). */
export function moved({ scheme, n, maxKey }) {
  if (scheme === "range") return 1 / (2 * n);
  let m = 0; for (let k = 0; k < maxKey; k++) if (shardOf(k, { scheme, n, maxKey }) !== shardOf(k, { scheme, n: n + 1, maxKey })) m++;
  return m / maxKey;
}
