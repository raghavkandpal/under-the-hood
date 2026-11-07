// Failure detection: a server sends a heartbeat every second; a monitor declares it dead when one is late.
// The network delays and drops some heartbeats, so "late" can mean "slow", not "dead". Times in seconds. No DOM.

import { quantile } from "../../shared/normal.js";

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

/** Heartbeat arrival times over `seconds` of healthy running, then the server crashes. */
export function arrivals({ seconds = 600, jitter = 0.15, loss = 0.02, rnd }) {
  const out = [];
  for (let t = 0; t < seconds; t++) if (rnd() >= loss) out.push(t + 0.05 + Math.abs(gauss(rnd)) * jitter);
  return out.sort((a, b) => a - b);
}

/**
 * Fixed timeout: dead when nothing has arrived for `timeout` s.
 * phi (accrual): suspicion grows with the silence, measured against the gaps seen so far (assumed roughly normal);
 * dead when phi = −log10 P(a gap this long) exceeds `phi`.
 */
export function simulate({ timeout, phi, seconds = 600, jitter = 0.15, loss = 0.02, rnd }) {
  const hb = arrivals({ seconds, jitter, loss, rnd }), gaps = [];
  const limit = () => {
    if (timeout !== undefined) return timeout;
    const n = gaps.length, m = gaps.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(gaps.reduce((a, g) => a + (g - m) ** 2, 0) / n) || 0.05;
    return m + Math.max(sd, 0.05) * quantile(1 - 10 ** -phi);
  };
  let falseAlarms = 0; const alarms = [];
  for (let k = 1; k < hb.length; k++) {
    const gap = hb[k] - hb[k - 1];
    if (gaps.length >= 5 && gap > limit()) { falseAlarms++; alarms.push(hb[k - 1] + limit()); }
    gaps.push(gap); if (gaps.length > 100) gaps.shift();
  }
  const last = hb.at(-1), declared = last + limit();
  return { heartbeats: hb, alarms, falseAlarms, crashAt: seconds, declared, detectAfter: declared - seconds };
}
