// CDNs: serve from a nearby edge cache instead of a faraway origin. Latency from distance, caching with TTLs,
// and request coalescing after a purge. No DOM.

/** Cities as [name, latitude, longitude]. */
export const CITIES = {
  virginia: ["Virginia", 38.9, -77.4], newyork: ["New York", 40.7, -74.0], sanfran: ["San Francisco", 37.8, -122.4], saopaulo: ["São Paulo", -23.6, -46.6],
  london: ["London", 51.5, -0.1], frankfurt: ["Frankfurt", 50.1, 8.7], lagos: ["Lagos", 6.5, 3.4], johannesburg: ["Johannesburg", -26.2, 28.0],
  mumbai: ["Mumbai", 19.1, 72.9], singapore: ["Singapore", 1.35, 103.8], tokyo: ["Tokyo", 35.7, 139.7], sydney: ["Sydney", -33.9, 151.2],
};
export const ORIGIN = "virginia";
export const USERS = ["newyork", "sanfran", "saopaulo", "london", "frankfurt", "lagos", "johannesburg", "mumbai", "singapore", "tokyo", "sydney", "virginia"];
export const POP_SETS = { none: [], three: ["virginia", "frankfurt", "singapore"], eight: ["virginia", "sanfran", "saopaulo", "london", "johannesburg", "mumbai", "singapore", "sydney"] };

/** Great-circle distance in km. */
export function km(a, b) {
  const [, la1, lo1] = CITIES[a], [, la2, lo2] = CITIES[b], r = Math.PI / 180;
  const h = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
/** Round-trip time in ms: light in fibre covers ~200 km per ms, real routes are ~1.5× longer than straight lines, plus a few ms of equipment. */
export const rtt = (a, b) => (a === b ? 5 : 2 * (km(a, b) * 1.5) / 200 + 4);
export const nearest = (user, pops) => pops.reduce((best, p) => (rtt(user, p) < rtt(user, best) ? p : best), pops[0]);

/**
 * Simulate `n` requests over `seconds`. Objects are picked with Zipf popularity (a few are very popular).
 * opts: { pops, ttl (s), objects, skew, purgeAt (s or null), coalesce }
 * Returns latency stats, hit rate and origin load (overall, and per second for a chart).
 */
export function simulate({ pops = [], ttl = 60, objects = 500, skew = 1.0, n = 20000, seconds = 120, purgeAt = null, coalesce = true, rnd }) {
  const weights = Array.from({ length: objects }, (_, i) => 1 / (i + 1) ** skew), total = weights.reduce((a, b) => a + b, 0);
  const cdf = []; weights.reduce((acc, w, i) => (cdf[i] = acc + w / total), 0);
  const pick = () => { const r = rnd(); let lo = 0, hi = objects - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; } return lo; };
  const cache = new Map(); // key pop|obj → { ready: when the origin's copy arrives, expires: when it goes stale }
  const lat = [], originPerSec = new Array(seconds).fill(0); let hits = 0, origin = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * seconds, user = USERS[Math.floor(rnd() * USERS.length)], obj = pick();
    if (purgeAt != null && t >= purgeAt && t - seconds / n < purgeAt) cache.clear(); // content changed: purge every edge
    if (!pops.length) { lat.push(rtt(user, ORIGIN) + 20); origin++; originPerSec[Math.floor(t)]++; continue; } // 20 ms of origin work
    const pop = nearest(user, pops), key = pop + "|" + obj, toEdge = rtt(user, pop);
    const c = cache.get(key);
    if (c && c.ready <= t && t < c.expires) { hits++; lat.push(toEdge); continue; }
    if (c && c.ready > t && coalesce) { lat.push(toEdge + (c.ready - t) * 1000); continue; } // a fetch is already under way: wait for it
    const fetchMs = rtt(pop, ORIGIN) + 20; // edge → origin and back, plus 20 ms of origin work
    origin++; originPerSec[Math.floor(t)]++;
    cache.set(key, { ready: t + fetchMs / 1000, expires: t + fetchMs / 1000 + ttl });
    lat.push(toEdge + fetchMs);
  }
  const s = [...lat].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: q(0.5), p95: q(0.95), hitRate: pops.length ? hits / n : 0, originRequests: origin, originPerSec, n };
}
