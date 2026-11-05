// A set-associative LRU cache simulator and memory access patterns. No DOM.

export class Cache {
  /** size and lineSize in bytes; ways = 1 is direct-mapped. */
  constructor({ size = 256, lineSize = 16, ways = 2 } = {}) {
    this.lineSize = lineSize; this.ways = ways;
    this.numSets = Math.max(1, Math.floor(size / lineSize / ways));
    this.sets = Array.from({ length: this.numSets }, () => []); // each: [{tag, last}] most-recent last
    this.hits = 0; this.misses = 0; this.clock = 0;
  }
  locate(addr) { const line = Math.floor(addr / this.lineSize); return { line, set: line % this.numSets, tag: Math.floor(line / this.numSets) }; }
  access(addr) {
    const { line, set, tag } = this.locate(addr), S = this.sets[set];
    const i = S.findIndex(e => e.tag === tag);
    this.clock++;
    if (i >= 0) { const [e] = S.splice(i, 1); e.last = this.clock; S.push(e); this.hits++; return { hit: true, set, tag, line }; }
    let evicted = null;
    if (S.length >= this.ways) evicted = S.shift();
    S.push({ tag, line, last: this.clock });
    this.misses++;
    return { hit: false, set, tag, line, evicted: evicted?.line ?? null };
  }
  get hitRate() { const t = this.hits + this.misses; return t ? this.hits / t : 0; }
}

/** Addresses touched when summing an n×n matrix of 4-byte ints stored row-major. */
export const PATTERNS = {
  rows: { label: "Row by row (follows memory order)", gen: n => { const a = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) a.push({ r, c }); return a; } },
  cols: { label: "Column by column (jumps a whole row each step)", gen: n => { const a = []; for (let c = 0; c < n; c++) for (let r = 0; r < n; r++) a.push({ r, c }); return a; } },
  tiled: { label: "In 4×4 tiles (blocked)", gen: n => { const a = [], T = 4; for (let R = 0; R < n; R += T) for (let C = 0; C < n; C += T) for (let r = R; r < Math.min(n, R + T); r++) for (let c = C; c < Math.min(n, C + T); c++) a.push({ r, c }); return a; } },
  random: { label: "Random order", gen: (n, seed = 3) => { const a = PATTERNS.rows.gen(n); let x = seed; for (let i = a.length - 1; i > 0; i--) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; } },
};
export const addrOf = ({ r, c }, n, elem = 4) => (r * n + c) * elem;

export function simulate(pattern, n, cfg) {
  const cache = new Cache(cfg), trace = PATTERNS[pattern].gen(n).map(p => ({ ...p, ...cache.access(addrOf(p, n)) }));
  return { cache, trace };
}

/** Rough latencies (ns) used to turn hits/misses into time. Orders of magnitude, not a spec sheet. */
export const LAT = { hit: 1, miss: 80 };
