// Padding oracle attack on CBC with the toy 2-byte-block cipher. No DOM. Real AES blocks are 16 bytes; the toy cipher is not secure.
import { cbcEncrypt, cbcDecrypt } from "../../shared/cipher-modes.js";
import { hmacSha1 } from "../../shared/totp.js";

export const K = 2; // block size in bytes

/** Append k - (len mod k) bytes, each holding that count: a full block when len is a multiple of k. */
export function pad(bytes, k = K) {
  const n = k - (bytes.length % k), out = new Uint8Array(bytes.length + n);
  out.set(bytes); out.fill(n, bytes.length); return out;
}

/** Strip valid padding, or return null if the last n bytes are not all n (1 <= n <= k). */
export function unpad(bytes, k = K) {
  const n = bytes[bytes.length - 1];
  if (!(n >= 1 && n <= k && bytes.length >= n)) return null;
  for (let i = bytes.length - n; i < bytes.length; i++) if (bytes[i] !== n) return null;
  return bytes.slice(0, bytes.length - n);
}

const ivBytes = iv => [iv >> 8, iv & 255];

/** A server that decrypts CBC and answers one bit: was the padding valid? With mac, it checks HMAC over IV and ciphertext first. */
export function makeServer(key, { mac = false } = {}) {
  const macKey = Uint8Array.of(key >>> 24, key >>> 16, key >>> 8, key);
  const tagOf = (iv, ct) => hmacSha1(macKey, Uint8Array.from([...ivBytes(iv), ...ct]));
  return {
    encrypt(plain, iv) { const ct = cbcEncrypt(pad(plain), key, iv); return { iv, ct, tag: mac ? tagOf(iv, ct) : null }; },
    /** The oracle: true if the request is accepted. Never reveals plaintext. */
    oracle(iv, ct, tag) {
      if (mac && String(tagOf(iv, ct)) !== String(tag)) return false;
      return unpad(cbcDecrypt(ct, key, iv)) !== null;
    },
  };
}

/** Recover the plaintext (padding included) of iv + ct from oracle answers alone. */
export function attack(oracle, iv, ct, tag) {
  let queries = 0; const answers = new Set(), plain = [], perBlock = [];
  const ask = (prev, block) => { queries++; const a = oracle(prev, block, tag); answers.add(a); return a; };
  for (let i = 0; i < ct.length; i += 2) {
    const prev = i ? (ct[i - 2] << 8) | ct[i - 1] : iv, c = ct.slice(i, i + 2), start = queries;
    // Last byte: forge the previous block until the padding reads 0x01. 0x02 0x02 also passes, so one check query rules it out.
    let I1 = -1, checked = false;
    for (let g = 0; g < 256 && I1 < 0; g++) {
      if (!ask(g, c)) continue;
      if (!checked) { checked = true; if (!ask(g ^ 0x100, c)) continue; }
      I1 = g ^ 1;
    }
    if (I1 < 0) break; // no guess was ever accepted
    // First byte: with the last byte forced to 0x02, only 0x02 0x02 is valid.
    let I0 = -1;
    for (let g = 0; g < 256 && I0 < 0; g++) if (ask((g << 8) | (I1 ^ 2), c)) I0 = g ^ 2;
    plain.push(I0 ^ (prev >> 8), I1 ^ (prev & 255));
    perBlock.push(queries - start);
  }
  const bytes = Uint8Array.from(plain);
  return { plain: bytes, text: bytes.length ? unpad(bytes) : null, queries, perBlock, answers };
}

/** The page's IV for a seed, so the printed run is reproducible. */
export const ivFor = seed => (seed * 40503 + 12345) & 0xffff;
