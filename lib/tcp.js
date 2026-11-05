// Deterministic, simplified TCP-like transfer: handshake, sliding window, cumulative ACKs,
// receiver-side buffering, retransmission on timeout and on 3 duplicate ACKs. No DOM.
// Segments are numbered 1..N (real TCP numbers bytes; the idea is the same).

export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const DEFAULTS = { segments: 10, window: 4, delay: 50, rto: 260, serialize: 12, lossPct: 0, seed: 7, fastRetransmit: true, drops: new Set(), maxTime: 20000 };

export function simulate(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const rng = mulberry32(o.seed);
  const q = []; let qseq = 0;
  const push = e => { e.k = qseq++; q.push(e); };
  const pop = () => { let bi = 0; for (let i = 1; i < q.length; i++) if (q[i].t < q[bi].t || (q[i].t === q[bi].t && q[i].k < q[bi].k)) bi = i; return q.splice(bi, 1)[0]; };

  const packets = [], log = [], counts = new Map();
  const linkFree = { c: 0, s: 0 };
  const stats = { sent: 0, retrans: 0, lost: 0, delivered: 0, timeouts: 0, fastRetrans: 0 };
  const note = (t, side, text, kind = "info") => log.push({ t, side, text, kind });

  function send(dir, label, info, t) {
    const side = dir === "c2s" ? "c" : "s";
    const t0 = Math.max(t, linkFree[side]); linkFree[side] = t0 + o.serialize;
    const n = (counts.get(dir + label) || 0) + 1; counts.set(dir + label, n);
    const key = `${dir}|${label}|${n}`;
    const roll = rng(); // always consume, so manual drops don't reshuffle random ones
    const lost = o.drops.has(key) || roll < o.lossPct / 100;
    const p = { id: packets.length, key, dir, label, ...info, t0, t1: t0 + o.delay, lost, retrans: n > 1 && info.kind !== "ack", dupAck: n > 1 && info.kind === "ack" };
    packets.push(p); stats.sent++; if (n > 1 && info.kind === "data") stats.retrans++; if (lost) stats.lost++;
    if (!lost) push({ t: p.t1, type: "arrive", p });
    return p;
  }

  // client (sender)
  const C = { phase: "syn", base: 1, next: 1, dup: 0, timerGen: 0, timerOn: false, done: null };
  // server (receiver)
  const S = { expected: 1, buf: new Set(), established: false };

  const arm = t => { C.timerGen++; C.timerOn = true; push({ t: t + o.rto, type: "timeout", gen: C.timerGen }); };
  const disarm = () => { C.timerGen++; C.timerOn = false; };
  function fill(t) {
    while (C.next < C.base + o.window && C.next <= o.segments) { send("c2s", `DATA ${C.next}`, { kind: "data", seq: C.next }, t); C.next++; }
    if (C.base < C.next && !C.timerOn) arm(t);
  }

  send("c2s", "SYN", { kind: "syn" }, 0); arm(0);
  note(0, "c", "Client sends SYN: \"I'd like to talk.\"");

  while (q.length) {
    const e = pop(); const t = e.t;
    if (t > o.maxTime) { note(t, "c", "Gave up (simulation time limit).", "bad"); break; }
    if (e.type === "timeout") {
      if (e.gen !== C.timerGen) continue;
      stats.timeouts++;
      if (C.phase === "syn") { note(t, "c", "No SYN-ACK before the timer fired. Resending SYN.", "bad"); send("c2s", "SYN", { kind: "syn" }, t); arm(t); continue; }
      note(t, "c", `Timeout waiting for ACK of segment ${C.base}. Retransmitting it.`, "bad");
      send("c2s", `DATA ${C.base}`, { kind: "data", seq: C.base }, t); C.dup = 0; arm(t);
      continue;
    }
    const p = e.p;
    if (p.dir === "c2s") {
      if (p.kind === "syn") {
        note(t, "s", S.established ? "Server gets a duplicate SYN and answers again." : "Server gets SYN, replies SYN-ACK: \"Sure, I'm listening.\"");
        send("s2c", "SYN-ACK", { kind: "synack" }, t);
      } else if (p.kind === "hsack") {
        if (!S.established) note(t, "s", "Handshake complete on the server side.", "good");
        S.established = true;
      } else if (p.kind === "data") {
        S.established = true;
        const k = p.seq;
        if (k === S.expected) {
          S.expected++; stats.delivered++;
          let extra = 0; while (S.buf.has(S.expected)) { S.buf.delete(S.expected); S.expected++; stats.delivered++; extra++; }
          note(t, "s", `Got segment ${k} in order${extra ? `, plus ${extra} already buffered behind it` : ""}. Delivered to the app up to ${S.expected - 1}.`, "good");
        } else if (k > S.expected) {
          S.buf.add(k); note(t, "s", `Got segment ${k}, but ${S.expected} is missing. Buffer it and re-ACK ${S.expected}.`, "warn");
        } else note(t, "s", `Got duplicate segment ${k} (already have it).`, "warn");
        send("s2c", `ACK ${S.expected}`, { kind: "ack", ack: S.expected }, t);
      }
    } else {
      if (p.kind === "synack") {
        if (C.phase === "syn") {
          C.phase = "est"; disarm();
          note(t, "c", "Client gets SYN-ACK, sends ACK. Connection open, data can flow.", "good");
          send("c2s", "ACK", { kind: "hsack" }, t);
          fill(t);
        } else send("c2s", "ACK", { kind: "hsack" }, t);
      } else if (p.kind === "ack" && C.phase === "est" && C.done == null) {
        const a = p.ack;
        if (a > C.base) {
          C.base = a; C.dup = 0;
          if (C.base > o.segments) { C.done = t; disarm(); note(t, "c", `All ${o.segments} segments acknowledged. Transfer complete.`, "good"); continue; }
          arm(t); fill(t);
        } else if (a === C.base) {
          C.dup++;
          if (C.dup === 3 && o.fastRetransmit) {
            stats.fastRetrans++;
            note(t, "c", `Third duplicate ACK for ${a}. Fast retransmit without waiting for the timer.`, "warn");
            send("c2s", `DATA ${C.base}`, { kind: "data", seq: C.base }, t); arm(t);
          }
        }
      }
    }
  }
  log.sort((a, b) => a.t - b.t);
  return { packets, log, stats, done: C.done, opts: o, end: Math.max(C.done ?? 0, ...packets.map(p => p.t1)) };
}
