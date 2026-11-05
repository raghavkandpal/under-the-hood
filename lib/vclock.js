// Lamport clocks and vector clocks over a log of local, send and receive events. No DOM.

export class History {
  constructor(n) { this.n = n; this.events = []; this.vc = Array.from({ length: n }, () => new Array(n).fill(0)); this.lc = new Array(n).fill(0); }
  push(p, kind, extra = {}) {
    const e = { id: this.events.length, p, kind, vc: this.vc[p].slice(), lamport: this.lc[p], ...extra, seq: this.events.filter(x => x.p === p).length };
    this.events.push(e); return e;
  }
  local(p) { this.vc[p][p]++; this.lc[p]++; return this.push(p, "local"); }
  /** Send and immediately receive (message delivery order is what the user clicks). */
  send(from, to) {
    this.vc[from][from]++; this.lc[from]++;
    const s = this.push(from, "send", { to });
    this.vc[to] = this.vc[to].map((v, i) => Math.max(v, s.vc[i])); this.vc[to][to]++;
    this.lc[to] = Math.max(this.lc[to], s.lamport) + 1;
    const r = this.push(to, "recv", { from, sendId: s.id });
    s.recvId = r.id; return [s, r];
  }
}

export const leq = (a, b) => a.every((v, i) => v <= b[i]);
/** "before" | "after" | "concurrent" | "same" */
export function relation(a, b) {
  if (a.id === b.id) return "same";
  if (leq(a.vc, b.vc)) return "before";
  if (leq(b.vc, a.vc)) return "after";
  return "concurrent";
}

/** Ground truth: can you get from a to b following process order and messages? */
export function reachable(h, a, b) {
  const seen = new Set([a.id]), stack = [a];
  while (stack.length) {
    const e = stack.pop(); if (e.id === b.id) return true;
    const next = h.events.filter(x => (x.p === e.p && x.seq === e.seq + 1) || (e.kind === "send" && x.id === e.recvId));
    for (const x of next) if (!seen.has(x.id)) { seen.add(x.id); stack.push(x); }
  }
  return false;
}
