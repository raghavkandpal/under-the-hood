// Retry storms and how to avoid them: naive retries vs exponential backoff with jitter vs a circuit breaker. No DOM.
// Discrete time. Each tick `rate` new requests arrive; the service can serve `cap` per tick. Past capacity it thrashes:
// time spent on requests that will time out anyway means goodput falls, reaching zero at 2× capacity.

export const POLICIES = { none: "No retries", naive: "Retry at once (×3)", backoff: "Backoff + jitter", budget: "Backoff + retry budget", breaker: "Backoff + circuit breaker" };

export function goodput(load, cap) { return load <= cap ? load : Math.max(0, cap * (2 - load / cap)); }

/**
 * opts: { policy, ticks, rate, cap, outage: [start, end), maxRetries, seed }
 * returns per-tick arrays: load (requests hitting the service), ok, failed (given up), shed (failed fast by breaker), state
 */
export function simulate({ policy = "naive", ticks = 160, rate = 70, cap = 100, outage = [40, 60], maxRetries = 3, seed = 1 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const due = new Map(); // tick -> [attempt numbers]
  const add = (t, a, n = 1) => { const arr = due.get(t) || []; for (let i = 0; i < n; i++) arr.push(a); due.set(t, arr); };
  const out = { load: [], ok: [], failed: [], shed: [], state: [] };
  let br = { state: "closed", opened: 0, window: [] }; const COOLDOWN = 8, THRESH = 0.5;
  for (let t = 0; t < ticks; t++) {
    const attempts = [...new Array(rate).fill(0), ...(due.get(t) || [])]; due.delete(t);
    // circuit breaker decides how many attempts actually reach the service
    let sent = attempts, shed = [];
    if (policy === "breaker") {
      if (br.state === "open" && t - br.opened >= COOLDOWN) br.state = "half";
      if (br.state === "open") { shed = attempts; sent = []; }
      else if (br.state === "half") { sent = attempts.slice(0, 5); shed = attempts.slice(5); } // a few probes
    }
    const down = t >= outage[0] && t < outage[1], load = sent.length, served = down ? 0 : Math.floor(goodput(load, cap));
    // who succeeds: random subset of sent attempts
    const idx = sent.map((a, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const okSet = new Set(idx.slice(0, served)); let ok = 0, failed = 0;
    let budget = policy === "budget" ? Math.ceil(rate * 0.1) : Infinity; // retries allowed this tick
    const retry = (a) => {
      if (policy === "none" || a >= maxRetries || budget <= 0) { failed++; return; }
      budget--;
      if (policy === "naive") add(t + 1, a + 1);
      else { const base = 2 ** (a + 1), delay = 1 + Math.floor(rnd() * base * 2); add(t + delay, a + 1); } // full jitter
    };
    sent.forEach((a, i) => { if (okSet.has(i)) ok++; else retry(a); });
    // shed requests fail fast: the caller gets an error (or a fallback) at once, and nothing is retried
    failed += shed.length;
    if (policy === "breaker") {
      const rate_ = sent.length ? (sent.length - ok) / sent.length : 0;
      if (br.state === "half") { if (sent.length && ok === sent.length) br.state = "closed"; else if (sent.length) { br.state = "open"; br.opened = t; } }
      else if (br.state === "closed" && sent.length >= 10 && rate_ > THRESH) { br.state = "open"; br.opened = t; }
    }
    out.load.push(load); out.ok.push(ok); out.failed.push(failed); out.shed.push(shed.length); out.state.push(br.state);
  }
  return out;
}

/** Ticks after the outage ends until goodput is back to the arrival rate (or Infinity if it never recovers). */
export function recoveryTime(r, outageEnd, rate) {
  for (let t = outageEnd; t < r.ok.length; t++) if (r.ok.slice(t, t + 5).every(x => x >= rate * 0.95)) return t - outageEnd;
  return Infinity;
}
