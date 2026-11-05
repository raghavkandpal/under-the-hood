// Fixed-width integers: two's complement, addition with carries and overflow, and bitwise ops. No DOM.

export const mask = w => (w === 32 ? 0xffffffff : (1 << w) - 1);
export const toUnsigned = (x, w) => (x & mask(w)) >>> 0;
export const toSigned = (u, w) => (u & (1 << (w - 1)) ? u - 2 ** w : u);
export const fromSigned = (s, w) => toUnsigned(s < 0 ? s + 2 ** w : s, w);
export const bitsOf = (u, w) => Array.from({ length: w }, (_, i) => (u >>> (w - 1 - i)) & 1);

/** Ripple-carry add of two w-bit patterns; reports carries and both overflow flags. */
export function add(a, b, w) {
  const A = bitsOf(a, w).reverse(), B = bitsOf(b, w).reverse(), sum = [], carries = [0];
  for (let i = 0; i < w; i++) { const s = A[i] + B[i] + carries[i]; sum.push(s & 1); carries.push(s >> 1); }
  const u = sum.reverse().reduce((x, bit) => x * 2 + bit, 0);
  const sa = toSigned(a, w), sb = toSigned(b, w), ss = toSigned(u, w);
  return { result: u, carries: carries.slice(1).reverse(), carryOut: carries[w], signedOverflow: (sa >= 0) === (sb >= 0) && (ss >= 0) !== (sa >= 0), trueSigned: sa + sb, trueUnsigned: a + b };
}
export const negate = (u, w) => toUnsigned(~u + 1, w);
export const OPS = {
  and: { label: "AND", f: (a, b) => a & b }, or: { label: "OR", f: (a, b) => a | b }, xor: { label: "XOR", f: (a, b) => a ^ b },
  shl: { label: "a << 1", f: a => a << 1 }, shr: { label: "a >> 1 (arithmetic)", f: (a, b, w) => fromSigned(toSigned(a, w) >> 1, w) }, ushr: { label: "a >>> 1 (logical)", f: a => a >>> 1 },
};
