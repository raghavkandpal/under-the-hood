// Idempotency keys: retrying a payment over a lossy network without charging twice. No DOM.

/**
 * One payment: the client sends "charge" and waits; the request or the response can be lost.
 * On no response it retries, up to `retries` more times. With keys, the server stores each key's result and
 * replays it for repeats instead of charging again.
 * Returns { charges (times the card was charged), confirmed (client got an answer), log }.
 */
export function pay({ lossReq, lossResp, retries = 3, keys, rnd }) {
  const seen = new Map(); let charges = 0; const log = [];
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (rnd() < lossReq) { log.push({ attempt, what: "request lost" }); continue; }
    let result;
    if (keys && seen.has("key-1")) { result = seen.get("key-1"); log.push({ attempt, what: "server: seen this key, replays the result" }); }
    else { charges++; result = `charge ${charges}`; if (keys) seen.set("key-1", result); log.push({ attempt, what: `server charges the card${charges > 1 ? " again" : ""}` }); }
    if (rnd() < lossResp) { log.push({ attempt, what: "response lost" }); continue; }
    log.push({ attempt, what: "client gets the confirmation" });
    return { charges, confirmed: true, log };
  }
  log.push({ attempt: retries, what: "client gives up" });
  return { charges, confirmed: false, log };
}

/** Many payments: how often each outcome happens. */
export function many({ n = 1000, ...opts }) {
  const out = { once: 0, twice: 0, never: 0, unconfirmed: 0 };
  for (let i = 0; i < n; i++) { const r = pay(opts); if (r.charges === 0) out.never++; else if (r.charges === 1) out.once++; else out.twice++; if (!r.confirmed) out.unconfirmed++; }
  return out;
}
