// TCP congestion control: senders share a bottleneck they can't see, probing for room and backing off on loss. No DOM.

/** How a window grows each round trip, and what happens on loss. AIMD is what TCP Reno does. */
export const RULES = {
  aimd: { inc: w => w + 1, dec: w => w / 2 },
  aiad: { inc: w => w + 1, dec: w => w - 8 },
  mimd: { inc: w => w * 1.1, dec: w => w / 2 },
};

/**
 * Flows share a link that carries `capacity` packets per round trip (plus a `buffer`). When the total window
 * exceeds that, every flow sees a loss in that round trip (synchronised loss) and applies its decrease.
 * flows: [{ start (RTT it joins), w (initial window) }]. slowStart: windows double until the first loss.
 */
export function simulate({ rule = "aimd", capacity = 50, buffer = 0, rtts = 200, flows = [{ start: 0, w: 1 }, { start: 40, w: 1 }], slowStart = true }) {
  const R = RULES[rule], w = flows.map(f => f.w), ss = flows.map(() => slowStart), series = flows.map(() => []), losses = [];
  let delivered = 0;
  for (let t = 0; t < rtts; t++) {
    const active = flows.map(f => t >= f.start), total = w.reduce((s, x, i) => s + (active[i] ? x : 0), 0);
    const lost = total > capacity + buffer;
    delivered += Math.min(total, capacity);
    if (lost) losses.push(t);
    flows.forEach((_, i) => {
      series[i].push(active[i] ? w[i] : null);
      if (!active[i]) return;
      if (lost) { w[i] = Math.max(1, R.dec(w[i])); ss[i] = false; } else w[i] = ss[i] ? w[i] * 2 : R.inc(w[i]);
    });
  }
  const half = Math.floor(rtts / 2), tail = series.map(s => s.slice(half).filter(x => x !== null));
  const avgs = tail.map(s => s.reduce((a, b) => a + b, 0) / (s.length || 1));
  return { series, losses, utilisation: delivered / (capacity * rtts), fairness: jain(avgs), avgs };
}
/** Jain's fairness index: 1 when everyone gets the same, 1/n when one flow gets everything. */
export const jain = xs => xs.reduce((a, b) => a + b, 0) ** 2 / (xs.length * xs.reduce((a, b) => a + b * b, 0));
