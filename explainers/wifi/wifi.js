// How Wi-Fi shares the air: the logic, with no DOM, so it can be tested in Node.
// Model constants are this page's own, not 802.11's timing values.
import { mulberry } from "../../shared/random.js";

export const CW_START = 16, CW_MAX = 1024;
export const DATA = 20, RTS = 2; // frame lengths in slots

/** Contention among n always-waiting stations. Each round every station picks a backoff slot; the lowest sends, a tie for lowest collides.
 *  A collision doubles the window of the stations in it (when `doubling`), a success resets the winner's. */
export function contend({ n, rounds, doubling, seed = 1 }) {
  const rnd = mulberry(seed), cw = Array(n).fill(CW_START);
  let collisions = 0;
  for (let r = 0; r < rounds; r++) {
    const pick = cw.map(w => Math.floor(rnd() * w)), low = Math.min(...pick);
    const tied = pick.flatMap((p, i) => (p === low ? [i] : []));
    if (tied.length > 1) { collisions++; if (doubling) for (const i of tied) cw[i] = Math.min(cw[i] * 2, CW_MAX); }
    else cw[tied[0]] = CW_START;
  }
  return { rounds, collisions, fraction: collisions / rounds };
}

/** Exact chance that two stations pick the same slot out of `slots`, by listing every pair. */
export function pairCollision(slots = CW_START) {
  let same = 0;
  for (let a = 0; a < slots; a++) for (let b = 0; b < slots; b++) if (a === b) same++;
  return { same, pairs: slots * slots, p: same / (slots * slots) };
}

/** Two stations sending to one access point, slot by slot. Each slot an idle station gets a new frame with chance `load`
 *  (the same for both). `hidden`: they can't hear each other. With `rts`, a station sends a short RTS first; the access
 *  point's CTS tells both to wait, so only RTS frames can collide. Lost airtime counts every slot the air carried a frame that was lost. */
export function twoStations({ hidden, rts, slots, load = 0.01, seed = 1 }) {
  const rnd = mulberry(seed), lost = new Uint8Array(slots);
  const st = [0, 1].map(() => ({ cw: CW_START, wait: -1, tx: null })); // wait -1: no frame waiting
  let nav = 0, sent = 0, lostFrames = 0, delivered = 0;
  const done = (s, ok) => { s.cw = ok ? CW_START : Math.min(s.cw * 2, CW_MAX); s.tx = null; s.wait = ok ? -1 : Math.floor(rnd() * s.cw); };
  for (let t = 0; t < slots; t++) {
    for (const s of st) if (!s.tx && s.wait < 0 && rnd() < load) s.wait = Math.floor(rnd() * s.cw);
    const starts = st.map((s, i) => !s.tx && s.wait >= 0 && nav === 0 && !(!hidden && st[1 - i].tx) && (s.wait === 0 || (s.wait--, false)));
    st.forEach((s, i) => { if (starts[i]) { s.tx = { kind: rts ? "rts" : "data", left: rts ? RTS : DATA, from: t, bad: false }; s.wait = -1; sent++; } });
    if (nav > 0) nav--;
    if (st[0].tx && st[1].tx) st[0].tx.bad = st[1].tx.bad = true;
    for (const s of st) {
      if (!s.tx || --s.tx.left > 0) continue;
      const { kind, from, bad } = s.tx;
      if (bad) { lostFrames++; lost.fill(1, from, t + 1); done(s, false); }
      else if (kind === "rts") { s.tx = { kind: "data", left: DATA, from: t + 1, bad: false }; nav = DATA; }
      else { delivered++; done(s, true); }
    }
  }
  return { sent, lostFrames, lostFraction: lostFrames / sent, delivered, lostAirtime: lost.reduce((a, b) => a + b, 0) / slots };
}

/** Stations get the same number of frames, so every station gets 1 / sum(1/rate), in the same unit as the rates. */
export function throughput(rates) {
  const each = 1 / rates.reduce((a, r) => a + 1 / r, 0);
  return { each, total: each * rates.length };
}
