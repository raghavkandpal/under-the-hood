// Getting server events to a browser: polling, long polling and a WebSocket, over the same stream of events. No DOM.

/** Event times in seconds: a Poisson process with `perMin` events a minute over `seconds`. */
export function events({ perMin, seconds = 600, rnd }) {
  const out = []; let t = 0;
  for (;;) { t += -Math.log(1 - rnd()) * 60 / perMin; if (t > seconds) return out; out.push(t); }
}

/** Rough sizes: an HTTP request plus response headers, and a WebSocket frame header. Payloads are the same in all three. */
export const HTTP_OVERHEAD = 800, WS_FRAME = 6, WS_PING_EVERY = 30;

/**
 * Deliver each event, returning per-event latency (s), when each request reached the server, and overhead bytes.
 * poll: ask every `interval` s. long: a request waits until an event or `timeout`, then a new one is sent (one RTT gap).
 * ws: one upgrade request, then frames both ways; a ping keeps the connection alive.
 */
export function deliver(method, evs, { interval = 10, timeout = 30, rtt = 0.1, seconds = 600 } = {}) {
  const latency = [], times = [];
  let bytes = 0;
  if (method === "poll") {
    for (let t = interval; t <= seconds; t += interval) times.push(t);
    for (const e of evs) latency.push(Math.ceil(e / interval) * interval - e + rtt / 2);
  } else if (method === "long") {
    let t = 0, i = 0;                                       // t: when the current request reaches the server
    while (t < seconds) {
      times.push(t);
      const next = evs[i];
      if (next !== undefined && next < t + timeout) {       // answer at once with every event waiting
        const at = Math.max(t, next);
        while (i < evs.length && evs[i] <= at) latency.push(at - evs[i++] + rtt / 2);
        t = at + rtt;                                       // response travels back, a new request travels out
      } else t += timeout + rtt;
    }
  } else {
    times.push(0);
    for (const e of evs) latency.push(rtt / 2);
    bytes = HTTP_OVERHEAD + evs.length * WS_FRAME + Math.floor(seconds / WS_PING_EVERY) * 2 * WS_FRAME;
  }
  if (method !== "ws") bytes = times.length * HTTP_OVERHEAD;
  const avg = latency.length ? latency.reduce((a, b) => a + b, 0) / latency.length : 0;
  return { latency, avg, requests: times.length, times, bytes };
}
