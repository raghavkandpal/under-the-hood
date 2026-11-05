// A toy heap allocator: free list with first-fit / best-fit / worst-fit, splitting and coalescing. No DOM.
import { mulberry } from "../../shared/random.js";

export const STRATEGIES = { first: "First fit", best: "Best fit", worst: "Worst fit" };

export class Heap {
  constructor(size = 128, strategy = "first", { coalesce = true } = {}) {
    this.size = size; this.strategy = strategy; this.coalesce = coalesce;
    this.blocks = [{ start: 0, size, free: true }]; this.nextId = 1; this.failed = 0; this.scanned = 0;
  }
  malloc(n) {
    const free = this.blocks.filter(b => b.free && b.size >= n);
    this.scanned += this.strategy === "first" ? (this.blocks.findIndex(b => b.free && b.size >= n) + 1 || this.blocks.length) : this.blocks.length;
    if (!free.length) { this.failed++; return null; }
    const b = this.strategy === "first" ? free[0] : this.strategy === "best" ? free.reduce((x, y) => (y.size < x.size ? y : x)) : free.reduce((x, y) => (y.size > x.size ? y : x));
    const i = this.blocks.indexOf(b), id = this.nextId++;
    if (b.size > n) this.blocks.splice(i + 1, 0, { start: b.start + n, size: b.size - n, free: true });
    this.blocks[i] = { start: b.start, size: n, free: false, id };
    return id;
  }
  free(id) {
    const i = this.blocks.findIndex(b => b.id === id); if (i < 0) return false;
    this.blocks[i] = { start: this.blocks[i].start, size: this.blocks[i].size, free: true };
    if (this.coalesce) this.merge();
    return true;
  }
  merge() { for (let i = 0; i < this.blocks.length - 1;) { const a = this.blocks[i], b = this.blocks[i + 1]; if (a.free && b.free) { a.size += b.size; this.blocks.splice(i + 1, 1); } else i++; } }
  stats() {
    const free = this.blocks.filter(b => b.free), totalFree = free.reduce((s, b) => s + b.size, 0), largest = Math.max(0, ...free.map(b => b.size));
    return { used: this.size - totalFree, totalFree, largest, holes: free.length, fragmentation: totalFree ? 1 - largest / totalFree : 0 };
  }
}

/** Run a random workload of mallocs and frees; returns final stats and failures. */
export function workload(strategy, { size = 256, steps = 400, seed = 1, coalesce = true } = {}) {
  const h = new Heap(size, strategy, { coalesce }), r = mulberry(seed), live = [];
  for (let s = 0; s < steps; s++) {
    if (live.length && r() < 0.45) { const k = Math.floor(r() * live.length); h.free(live[k]); live.splice(k, 1); }
    else { const n = r() < 0.7 ? 1 + Math.floor(r() * 8) : 10 + Math.floor(r() * 24); const id = h.malloc(n); if (id) live.push(id); }
  }
  return { heap: h, ...h.stats(), failed: h.failed, scanned: h.scanned };
}
