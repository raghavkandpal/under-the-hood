// Consistent hashing ring with virtual nodes, compared against naive mod-N placement. No DOM.
import { HASHES } from "./hashtable.js";

const fnv = HASHES.fnv1a.fn;
// FNV-1a alone clusters on similar short strings; a final avalanche (murmur3 fmix32) spreads it over the ring.
export function hash32(s) {
  let h = fnv(s);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export const RING = 2 ** 32;

export class Ring {
  constructor(servers = [], vnodes = 1) { this.vnodes = vnodes; this.servers = []; this.points = []; servers.forEach(s => this.add(s)); }
  add(name) {
    if (this.servers.includes(name)) return;
    this.servers.push(name);
    for (let v = 0; v < this.vnodes; v++) this.points.push({ pos: hash32(`${name}#${v}`), server: name, v });
    this.points.sort((a, b) => a.pos - b.pos || (a.server < b.server ? -1 : 1));
  }
  remove(name) { this.servers = this.servers.filter(s => s !== name); this.points = this.points.filter(p => p.server !== name); }
  /** First point clockwise from the key's position (binary search). */
  lookup(key) {
    const h = hash32(key), P = this.points;
    if (!P.length) return null;
    let lo = 0, hi = P.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (P[mid].pos < h) lo = mid + 1; else hi = mid; }
    return P[lo % P.length].server;
  }
}

export const modN = (key, servers) => servers.length ? servers[hash32(key) % servers.length] : null;

export function assignment(keys, fn) { const m = new Map(); for (const k of keys) m.set(k, fn(k)); return m; }
export function moved(a, b) { let n = 0; for (const [k, v] of a) if (b.get(k) !== v) n++; return n; }
export function loads(assign, servers) { const c = Object.fromEntries(servers.map(s => [s, 0])); for (const v of assign.values()) if (v in c) c[v]++; return c; }
