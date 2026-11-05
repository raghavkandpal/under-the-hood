// Cache eviction policies (FIFO, LRU, LFU, random, and Belady's optimal) on access traces. No DOM.
import { mulberry } from "../../shared/random.js";

export const POLICIES = { fifo: "FIFO", lru: "LRU", lfu: "LFU", random: "Random", opt: "Optimal (sees the future)" };

export function simulate(trace, size, policy, seed = 1) {
  const r = mulberry(seed), cache = new Map(); // key -> {t, freq, added}
  let hits = 0; const steps = [];
  trace.forEach((k, t) => {
    let evicted = null, hit = cache.has(k);
    if (hit) { hits++; const e = cache.get(k); e.t = t; e.freq++; }
    else {
      if (cache.size >= size) {
        const keys = [...cache.keys()];
        if (policy === "fifo") evicted = keys.reduce((a, b) => (cache.get(b).added < cache.get(a).added ? b : a));
        else if (policy === "lru") evicted = keys.reduce((a, b) => (cache.get(b).t < cache.get(a).t ? b : a));
        else if (policy === "lfu") evicted = keys.reduce((a, b) => { const A = cache.get(a), B = cache.get(b); return B.freq < A.freq || (B.freq === A.freq && B.t < A.t) ? b : a; });
        else if (policy === "random") evicted = keys[Math.floor(r() * keys.length)];
        else { const next = key => { const i = trace.indexOf(key, t + 1); return i < 0 ? Infinity : i; }; evicted = keys.reduce((a, b) => (next(b) > next(a) ? b : a)); }
        cache.delete(evicted);
      }
      cache.set(k, { t, freq: 1, added: t });
    }
    steps.push({ k, hit, evicted, contents: [...cache.keys()] });
  });
  return { hits, rate: hits / trace.length, steps };
}

export const TRACES = {
  zipf: { label: "Popular items (a few keys get most requests)", gen: (n, r) => { const K = 30, w = Array.from({ length: K }, (_, i) => 1 / (i + 1)), s = w.reduce((a, b) => a + b); return Array.from({ length: n }, () => { let u = r() * s, i = 0; while ((u -= w[i]) > 0 && i < K - 1) i++; return i; }); } },
  loop: { label: "Loop slightly bigger than the cache", gen: (n, r, size) => Array.from({ length: n }, (_, i) => i % (size + 1)) },
  scan: { label: "Hot set + occasional full scan", gen: (n, r) => { const out = []; while (out.length < n) { for (let i = 0; i < 40; i++) out.push(Math.floor(r() * 4)); for (let i = 0; i < 20; i++) out.push(100 + i); } return out.slice(0, n); } },
  shift: { label: "Popularity shifts halfway", gen: (n, r) => Array.from({ length: n }, (_, i) => (i < n / 2 ? 0 : 10) + Math.floor(r() * r() * 8)) },
};
export const makeTrace = (kind, n, size, seed = 1) => TRACES[kind].gen(n, mulberry(seed), size);
