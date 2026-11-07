// HTTP/1.1, HTTP/2 and HTTP/3 loading one page of small files over a lossy link, in whole round trips. No DOM.

/**
 * h1: 6 TCP connections, one request at a time each; a loss delays only that connection's file.
 * h2: one TCP connection, every file multiplexed; a lost packet stalls the whole connection (TCP head-of-line blocking).
 * h3: QUIC over UDP, multiplexed; a loss delays only its own stream. Its handshake is one round trip, not two.
 * `perRtt` is how many files the link carries per round trip.
 */
export const PROTOCOLS = { h1: { handshake: 2, conns: 6 }, h2: { handshake: 2, conns: 1 }, h3: { handshake: 1, conns: 1 } };

export function load(proto, { files = 30, loss = 0, perRtt = 12, rnd }) {
  const P = PROTOCOLS[proto], out = Array.from({ length: files }, () => ({ start: null, end: null, stalls: [] }));
  let t = P.handshake, next = 0;
  if (proto === "h1") {
    const busy = new Array(P.conns).fill(null);
    while (out.some(f => f.end === null)) {
      for (let c = 0; c < P.conns; c++) if (busy[c] === null && next < files) { busy[c] = next; out[next++].start = t; }
      for (let c = 0; c < P.conns; c++) { const i = busy[c]; if (i === null) continue;
        if (rnd() < loss) out[i].stalls.push(t); else { out[i].end = t + 1; busy[c] = null; } }
      t++;
    }
  } else {
    out.forEach(f => (f.start = t));
    while (out.some(f => f.end === null)) {
      const flying = out.map((f, i) => i).filter(i => out[i].end === null).slice(0, perRtt), lost = flying.map(() => rnd() < loss);
      if (proto === "h2" && lost.some(Boolean)) flying.forEach(i => out[i].stalls.push(t));
      else flying.forEach((i, k) => (lost[k] ? out[i].stalls.push(t) : (out[i].end = t + 1)));
      t++;
    }
  }
  return { files: out, total: Math.max(...out.map(f => f.end)) };
}

/** Average page-load time in round trips over many loads. */
export function average(proto, opts, runs, rnd) {
  let s = 0; for (let r = 0; r < runs; r++) s += load(proto, { ...opts, rnd }).total; return s / runs;
}
