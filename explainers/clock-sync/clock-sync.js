// Clock synchronisation the NTP way: four timestamps, offset and delay, path asymmetry, filtering, drift. No DOM.
// Times are in milliseconds. The client's clock reads true time + offset (+ drift over time).

/**
 * One request/response exchange.
 * t1: client sends (client clock), t2: server receives (server clock), t3: server replies, t4: client receives (client clock).
 */
export function exchange({ trueTime = 0, clientOffset, out, back, serverWork = 1 }) {
  const t1 = trueTime + clientOffset, t2 = trueTime + out, t3 = t2 + serverWork, t4 = trueTime + out + serverWork + back + clientOffset;
  return { t1, t2, t3, t4 };
}

/** NTP's estimate: how far the server is ahead of the client, and the round-trip network delay. */
export function estimate({ t1, t2, t3, t4 }) { return { offset: ((t2 - t1) + (t3 - t4)) / 2, delay: (t4 - t1) - (t3 - t2) }; }

/** Run n exchanges with random one-way delays; NTP keeps the sample with the smallest round trip. */
export function sample(n, { clientOffset, base = 20, jitter = 30, asym = 0, rnd = Math.random }) {
  const xs = [];
  for (let i = 0; i < n; i++) {
    const out = base + asym / 2 + rnd() ** 2 * jitter, back = base - asym / 2 + rnd() ** 2 * jitter; // queueing delay is usually small, occasionally large
    const e = estimate(exchange({ trueTime: i * 1000, clientOffset, out, back }));
    xs.push({ ...e, out, back, error: (-e.offset) - clientOffset });
  }
  const best = xs.reduce((a, b) => (b.delay < a.delay ? b : a));
  const avg = xs.reduce((s, x) => s + x.offset, 0) / n;
  return { samples: xs, best, avgError: (-avg) - clientOffset };
}

/** Clock error over time: drifting at `ppm` (parts per million), corrected every `interval` seconds to within `residual` ms. */
export function driftSeries(seconds, { ppm = 20, interval = 64, residual = 1 } = {}) {
  const out = []; let err = residual;
  for (let t = 0; t <= seconds; t++) { if (t > 0 && t % interval === 0) err = residual; else if (t > 0) err += ppm / 1000; out.push(err); } // 1 ppm = 1 µs per second = 0.001 ms
  return out;
}
