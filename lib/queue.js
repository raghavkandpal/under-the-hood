// Queueing: an M/M/c simulator (shared line or separate lines) and the closed-form results it should match. No DOM.
import { mulberry } from "./autograd.js";

const expo = (r, rate) => -Math.log(1 - r()) / rate;

/** Erlang C: probability an arrival has to wait in an M/M/c queue. a = λ/μ (offered load). */
export function erlangC(c, a) {
  if (a >= c) return 1;
  let sum = 0, term = 1;
  for (let k = 0; k < c; k++) { if (k) term *= a / k; sum += term; }
  const last = term * a / c * (c / (c - a)); // a^c/c! * c/(c-a)
  return last / (sum + last);
}
/** Mean time in system W for M/M/c with a shared queue. */
export function theoryW(lambda, mu, c) {
  if (lambda >= c * mu) return Infinity;
  return erlangC(c, lambda / mu) / (c * mu - lambda) + 1 / mu;
}

/**
 * Simulate n customers. pooled: one shared line feeding c servers; otherwise each arrival picks a random server's line.
 * Returns averages plus a sampled trace of how many are waiting.
 */
export function simulate({ lambda, mu, servers = 1, pooled = true, n = 20000, seed = 1, warmup = 0.1 }) {
  const r = mulberry(seed);
  const free = new Array(servers).fill(0); // time each server becomes free
  let t = 0, sumW = 0, sumWq = 0, counted = 0, busy = 0;
  const trace = [], events = [];
  for (let i = 0; i < n; i++) {
    t += expo(r, lambda);
    let s;
    if (pooled) { s = 0; for (let k = 1; k < servers; k++) if (free[k] < free[s]) s = k; }
    else s = Math.floor(r() * servers);
    const start = Math.max(t, free[s]), svc = expo(r, mu), end = start + svc;
    free[s] = end;
    if (i >= n * warmup) { sumW += end - t; sumWq += start - t; counted++; busy += svc; }
    events.push([t, +1], [end, -1]);
  }
  // number in system over time, via the arrival/departure event list
  events.sort((a, b) => a[0] - b[0]);
  let inSys = 0, area = 0, lastT = events[0][0], t0 = events[Math.floor(events.length * warmup)][0];
  const T = events.at(-1)[0], step = (T - t0) / 300; let nextSample = t0;
  for (const [et, d] of events) {
    if (et > t0) area += inSys * (et - Math.max(lastT, t0));
    while (et >= nextSample && nextSample <= T) { trace.push({ t: nextSample, n: inSys }); nextSample += step; }
    inSys += d; lastT = et;
  }
  const W = sumW / counted, L = area / (T - t0);
  return { W, Wq: sumWq / counted, L, util: lambda / (servers * mu), trace, lambdaEff: counted / (T - t0) };
}
