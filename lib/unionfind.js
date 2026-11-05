// Union-find (disjoint sets) with optional union-by-rank and path compression, counting the work done. No DOM.
import { mulberry } from "./autograd.js";

export class DSU {
  constructor(n, { rank = true, compress = true } = {}) { this.p = Array.from({ length: n }, (_, i) => i); this.r = new Array(n).fill(0); this.opt = { rank, compress }; this.work = 0; this.sets = n; }
  find(x) {
    let root = x; while (this.p[root] !== root) { root = this.p[root]; this.work++; }
    if (this.opt.compress) while (this.p[x] !== root) { const nx = this.p[x]; this.p[x] = root; x = nx; }
    return root;
  }
  union(a, b) {
    let ra = this.find(a), rb = this.find(b); if (ra === rb) return false;
    if (this.opt.rank) { if (this.r[ra] < this.r[rb]) [ra, rb] = [rb, ra]; if (this.r[ra] === this.r[rb]) this.r[ra]++; }
    this.p[rb] = ra; this.sets--; return true;
  }
  depth(x) { let d = 0; while (this.p[x] !== x) { x = this.p[x]; d++; } return d; }
  maxDepth() { return Math.max(...this.p.map((_, i) => this.depth(i))); }
}

/** Kruskal's minimum spanning tree on a random grid graph — a classic union-find application. */
export function gridGraph(w, h, seed = 1) {
  const r = mulberry(seed), edges = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x < w - 1) edges.push({ a: i, b: i + 1, w: Math.round(r() * 9) + 1 }); if (y < h - 1) edges.push({ a: i, b: i + w, w: Math.round(r() * 9) + 1 }); }
  return edges;
}
export function kruskal(n, edges) {
  const d = new DSU(n), order = edges.slice().sort((x, y) => x.w - y.w), steps = [];
  for (const e of order) { const ok = d.union(e.a, e.b); steps.push({ e, taken: ok }); if (d.sets === 1) break; }
  return { steps, total: steps.filter(s => s.taken).reduce((s, x) => s + x.e.w, 0) };
}
