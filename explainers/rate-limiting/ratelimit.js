// Three rate limiters fed the same request stream. Times in seconds. No DOM.
import { mulberry } from "../../shared/random.js";

export class FixedWindow {
  constructor(limit, window) { Object.assign(this, { limit, window }); this.start = 0; this.count = 0; }
  allow(t) { const w = Math.floor(t / this.window) * this.window; if (w !== this.start) { this.start = w; this.count = 0; } if (this.count < this.limit) { this.count++; return true; } return false; }
}
export class SlidingLog {
  constructor(limit, window) { Object.assign(this, { limit, window }); this.log = []; }
  allow(t) { while (this.log.length && this.log[0] <= t - this.window) this.log.shift(); if (this.log.length < this.limit) { this.log.push(t); return true; } return false; }
}
export class TokenBucket {
  /** capacity = max burst, rate = tokens added per second */
  constructor(capacity, rate) { Object.assign(this, { capacity, rate }); this.tokens = capacity; this.last = 0; }
  level(t) { return Math.min(this.capacity, this.tokens + (t - this.last) * this.rate); }
  allow(t) { this.tokens = this.level(t); this.last = t; if (this.tokens >= 1) { this.tokens -= 1; return true; } return false; }
}

export const LIMITERS = {
  fixed: { label: "Fixed window", make: (limit, window) => new FixedWindow(limit, window) },
  sliding: { label: "Sliding window", make: (limit, window) => new SlidingLog(limit, window) },
  bucket: { label: "Token bucket", make: (limit, window) => new TokenBucket(limit, limit / window) },
};

/** Request times over [0, T): a steady background rate plus optional bursts. */
export const PATTERNS = {
  steady: { label: "Steady, under the limit", gen: (T, r) => poisson(T, 6, r) },
  bursty: { label: "Quiet, then bursts", gen: (T, r) => [...poisson(T, 2, r), ...burst(2.5, 25, 0.4, r), ...burst(6.2, 25, 0.4, r)].sort((a, b) => a - b) },
  boundary: { label: "Burst at a window boundary", gen: (T, r) => [...poisson(T, 1, r), ...burst(3.8, 10, 0.18, r), ...burst(4.02, 10, 0.18, r)].sort((a, b) => a - b) },
  overload: { label: "Sustained overload", gen: (T, r) => poisson(T, 18, r) },
};
function poisson(T, rate, r) { const out = []; let t = 0; for (;;) { t += -Math.log(1 - r()) / rate; if (t >= T) return out; out.push(t); } }
function burst(at, n, spread, r) { return Array.from({ length: n }, () => at + r() * spread); }

export function run(kind, times, limit, window) {
  const L = LIMITERS[kind].make(limit, window);
  return times.map(t => ({ t, ok: L.allow(t), level: L instanceof TokenBucket ? L.tokens : null }));
}
/** Max accepted requests in any sliding interval of length `window`. */
export function worstWindow(results, window) {
  const ok = results.filter(r => r.ok).map(r => r.t); let best = 0, j = 0;
  for (let i = 0; i < ok.length; i++) { while (ok[i] - ok[j] >= window) j++; best = Math.max(best, i - j + 1); }
  return best;
}
export const makeTraffic = (pattern, T = 10, seed = 1) => PATTERNS[pattern].gen(T, mulberry(seed));
