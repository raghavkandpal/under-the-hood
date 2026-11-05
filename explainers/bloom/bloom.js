// Bloom filter with Kirsch–Mitzenmacher double hashing. No DOM.
import { HASHES } from "../../shared/hashtable.js";

const h2 = s => { let h = 5381; for (const c of s) h = (Math.imul(h, 33) ^ c.codePointAt(0)) >>> 0; return (h | 1) >>> 0; }; // djb2-xor, forced odd, kept unsigned

export class Bloom {
  constructor(m = 64, k = 3) { this.m = m; this.k = k; this.bits = new Uint8Array(m); this.n = 0; }
  positions(item) {
    const a = HASHES.fnv1a.fn(item), b = h2(item), out = [];
    for (let i = 0; i < this.k; i++) out.push(Number((BigInt(a) + BigInt(i) * BigInt(b)) % BigInt(this.m)));
    return out;
  }
  add(item) { const p = this.positions(item); for (const i of p) this.bits[i] = 1; this.n++; return p; }
  has(item) { const p = this.positions(item); return { maybe: p.every(i => this.bits[i]), positions: p }; }
  fill() { return this.bits.reduce((a, b) => a + b, 0) / this.m; }
}

/** Expected false-positive rate after n insertions. */
export const fpRate = (m, k, n) => (1 - Math.exp(-k * n / m)) ** k;
/** k that minimises false positives for given m, n. */
export const optimalK = (m, n) => Math.max(1, Math.round((m / Math.max(1, n)) * Math.LN2));

// Deterministic pseudo-words for inserting and testing.
const SYL = ["ka", "lo", "mi", "ren", "to", "vu", "sa", "pel", "dor", "fi", "gan", "zu", "bri", "mo", "tal", "ne", "qui", "ro", "sha", "wex"];
export function pseudoWords(count, seed = 1) {
  const out = new Set(); let x = seed >>> 0;
  const r = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  while (out.size < count) out.add(Array.from({ length: 2 + Math.floor(r() * 2) }, () => SYL[Math.floor(r() * SYL.length)]).join(""));
  return [...out];
}
