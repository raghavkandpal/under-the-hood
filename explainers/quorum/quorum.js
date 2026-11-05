// Dynamo-style quorum replication: N copies, write to W, read from R. No DOM.
import { mulberry } from "../../shared/random.js";

export class Cluster {
  constructor(N, seed = 1) { this.N = N; this.r = mulberry(seed); this.nodes = Array.from({ length: N }, (_, i) => ({ id: i, up: true, version: 0, value: "v0" })); this.latest = 0; }
  alive() { return this.nodes.filter(n => n.up); }
  pick(k) { const a = this.alive().slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); }
  /** Each node replies after a random delay; an op finishes when the k-th fastest reply arrives. */
  latency(k) { const ds = this.alive().map(() => 5 + -Math.log(1 - this.r()) * 20).sort((a, b) => a - b); return ds[k - 1]; }
  write(value, W) {
    if (this.alive().length < W) return { ok: false, why: `only ${this.alive().length} replica${this.alive().length === 1 ? "" : "s"} up, need ${W}` };
    const v = ++this.latest, targets = this.pick(W);
    for (const n of targets) { n.version = v; n.value = value; }
    return { ok: true, version: v, targets: targets.map(n => n.id), ms: this.latency(W) };
  }
  read(R) {
    if (this.alive().length < R) return { ok: false, why: `only ${this.alive().length} replica${this.alive().length === 1 ? "" : "s"} up, need ${R}` };
    const asked = this.pick(R), best = asked.reduce((a, b) => (b.version > a.version ? b : a));
    return { ok: true, value: best.value, version: best.version, stale: best.version < this.latest, asked: asked.map(n => n.id), ms: this.latency(R) };
  }
}

/** Monte-Carlo: how often is a read stale, right after a write? */
export function staleness(N, R, W, trials = 2000, seed = 1) {
  const c = new Cluster(N, seed); let stale = 0, rl = 0, wl = 0;
  for (let i = 0; i < trials; i++) { const w = c.write("x" + i, W); wl += w.ms; const r = c.read(R); rl += r.ms; if (r.stale) stale++; }
  return { stale: stale / trials, readMs: rl / trials, writeMs: wl / trials };
}
