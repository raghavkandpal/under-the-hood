// Block cipher modes with a toy 16-bit block cipher. For teaching only: real ciphers (AES) use 128-bit blocks. No DOM.

/** A 4-round Feistel cipher on 16-bit blocks, with an S-box derived from the key. */
export function makeCipher(key) {
  let s = (key >>> 0) || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const S = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [S[i], S[j]] = [S[j], S[i]]; }
  const K = Array.from({ length: 4 }, () => Math.floor(rnd() * 256));
  const F = (r, k) => S[(r ^ k) & 255] ^ S[((r << 1) | (r >> 7)) & 255];
  return {
    enc(b) { let L = b >> 8, R = b & 255; for (const k of K) [L, R] = [R, L ^ F(R, k)]; return (L << 8) | R; },
    dec(b) { let L = b >> 8, R = b & 255; for (const k of [...K].reverse()) [L, R] = [R ^ F(L, k), L]; return (L << 8) | R; },
  };
}

const toBlocks = bytes => { const b = []; for (let i = 0; i < bytes.length; i += 2) b.push((bytes[i] << 8) | (bytes[i + 1] ?? 0)); return b; };
const toBytes = blocks => Uint8Array.from(blocks.flatMap(b => [b >> 8, b & 255]));

/** ECB: encrypt each block on its own. Equal plaintext blocks give equal ciphertext blocks. */
export const ecbEncrypt = (bytes, key) => { const c = makeCipher(key); return toBytes(toBlocks(bytes).map(c.enc)); };
export const ecbDecrypt = (bytes, key) => { const c = makeCipher(key); return toBytes(toBlocks(bytes).map(c.dec)); };

/** CBC: XOR each block with the previous ciphertext block (the first with the IV) before encrypting. */
export function cbcEncrypt(bytes, key, iv) { const c = makeCipher(key); let prev = iv & 0xffff; return toBytes(toBlocks(bytes).map(p => (prev = c.enc(p ^ prev)))); }
export function cbcDecrypt(bytes, key, iv) { const c = makeCipher(key); let prev = iv & 0xffff; return toBytes(toBlocks(bytes).map(x => { const p = c.dec(x) ^ prev; prev = x; return p; })); }

/** CTR: encrypt a counter to make a keystream, XOR it with the data. Decrypting is the same operation. */
export function ctr(bytes, key, nonce) { const c = makeCipher(key); return toBytes(toBlocks(bytes).map((p, i) => p ^ c.enc((nonce + i) & 0xffff))); }

export const xor = (a, b) => Uint8Array.from(a, (v, i) => v ^ b[i]);
export const flipBit = (bytes, byteIndex, bit = 0) => { const c = Uint8Array.from(bytes); c[byteIndex] ^= 1 << bit; return c; };

/** Fraction of 2-byte blocks that repeat an earlier block: a leak in ciphertext, harmless in plaintext. */
export function repeatedBlocks(bytes) { const seen = new Set(), b = toBlocks(bytes); let rep = 0; for (const x of b) { if (seen.has(x)) rep++; seen.add(x); } return rep / b.length; }
