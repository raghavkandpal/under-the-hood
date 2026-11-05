// Load-balancing strategies over N servers with random request sizes. Event-driven, deterministic per seed. No DOM.
import { mulberry } from "../../shared/random.js";

export const STRATEGIES = {
  rr: { label: "Round robin" },
  random: { label: "Random" },
  two: { label: "Power of two choices" },
  least: { label: "Least connections" },
};

/**
 * Each server processes its queue one request at a time. Request sizes are exponential (mean 1),
 * or "heavy" (mostly small, occasionally huge). load = utilisation per server.
 */
export function simulate({ strategy, servers = 8, load = 0.85, n = 20000, heavy = false, seed = 1, slow = 0 }) {
  const r = mulberry(seed), rate = load * servers;
  const busyUntil = new Array(servers).fill(0), queues = Array.from({ length: servers }, () => []); // departure times
  const speed = Array.from({ length: servers }, (_, i) => (i < slow ? 0.4 : 1));
  let t = 0, rrNext = 0; const lat = [], snaps = [];
  const inSystem = (s, now) => { const q = queues[s]; while (q.length && q[0] <= now) q.shift(); return q.length; };
  // heavy: 95% tiny (mean 0.3), 5% huge (mean 14.3), so the overall mean is still 1 and load stays as set
  const size = () => (heavy ? (r() < 0.05 ? 9 + r() * 10.6 : 0.2 + r() * 0.2) : -Math.log(1 - r()));
  for (let i = 0; i < n; i++) {
    t += -Math.log(1 - r()) / rate;
    let s;
    if (strategy === "rr") { s = rrNext; rrNext = (rrNext + 1) % servers; }
    else if (strategy === "random") s = Math.floor(r() * servers);
    else if (strategy === "two") { const a = Math.floor(r() * servers), b = Math.floor(r() * servers); s = inSystem(a, t) <= inSystem(b, t) ? a : b; }
    else { let best = 0, bl = Infinity; for (let k = 0; k < servers; k++) { const l = inSystem(k, t); if (l < bl) { bl = l; best = k; } } s = best; }
    const start = Math.max(t, busyUntil[s]), end = start + size() / speed[s];
    busyUntil[s] = end; queues[s].push(end);
    if (i > n * 0.1) lat.push(end - t);
    if (i % Math.floor(n / 200) === 0) snaps.push(Array.from({ length: servers }, (_, k) => inSystem(k, t)));
  }
  lat.sort((a, b) => a - b);
  const q = p => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))];
  return { p50: q(0.5), p99: q(0.99), mean: lat.reduce((a, b) => a + b, 0) / lat.length, snaps };
}
