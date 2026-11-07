// HyperLogLog: count distinct items in a few kilobytes by remembering only the rarest-looking hash in each bucket. No DOM.

import { hash } from "../../shared/hash32.js";

/** A sketch with 2^p registers. Each item's hash picks a register with its top p bits; the register keeps the longest run of leading zeros (+1) seen in the rest. */
export function sketch(p) { return { p, reg: new Uint8Array(1 << p) }; }
export function add(sk, item) {
  const h = hash(item), idx = h >>> (32 - sk.p), rest = (h << sk.p) >>> 0;
  const rank = Math.min(Math.clz32(rest), 32 - sk.p) + 1;
  if (rank > sk.reg[idx]) sk.reg[idx] = rank;
}
/** The estimate: a bias-corrected harmonic mean of 2^register, with linear counting while many registers are still empty. */
export function estimate(sk) {
  const m = sk.reg.length, alpha = m >= 128 ? 0.7213 / (1 + 1.079 / m) : { 16: 0.673, 32: 0.697, 64: 0.709 }[m];
  let sum = 0, zeros = 0; for (const r of sk.reg) { sum += 2 ** -r; if (!r) zeros++; }
  const raw = alpha * m * m / sum;
  return raw <= 2.5 * m && zeros ? m * Math.log(m / zeros) : raw;
}
/** Union of two sketches of the same size: the larger register wins. */
export function merge(a, b) { const out = sketch(a.p); out.reg.forEach((_, i) => (out.reg[i] = Math.max(a.reg[i], b.reg[i]))); return out; }
export const stdError = p => 1.04 / Math.sqrt(1 << p);
