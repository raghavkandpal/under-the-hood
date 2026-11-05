// One-time codes for two-factor login: HMAC-SHA1 → HOTP (RFC 4226) → TOTP (RFC 6238). No DOM.
import { sha1 } from "./git.js";

const hexToBytes = h => Uint8Array.from(h.match(/../g), b => parseInt(b, 16));
export const textBytes = s => new TextEncoder().encode(s);

/** HMAC-SHA1(key, message), as bytes. */
export function hmacSha1(key, msg) {
  if (key.length > 64) key = hexToBytes(sha1(key));
  const k = new Uint8Array(64); k.set(key);
  const inner = new Uint8Array(64 + msg.length), outer = new Uint8Array(64 + 20);
  for (let i = 0; i < 64; i++) { inner[i] = k[i] ^ 0x36; outer[i] = k[i] ^ 0x5c; }
  inner.set(msg, 64); outer.set(hexToBytes(sha1(inner)), 64);
  return hexToBytes(sha1(outer));
}

/** HOTP: the code for a given counter. Also returns the intermediate values so a page can show them. */
export function hotp(secret, counter, digits = 6) {
  const msg = new Uint8Array(8); let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(c & 0xffn); c >>= 8n; }
  const h = hmacSha1(secret, msg), offset = h[19] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return { code: String(bin % 10 ** digits).padStart(digits, "0"), hmac: h, offset, bin };
}

/** TOTP: HOTP with counter = number of 30-second steps since 1970. */
export const counterAt = (unixSeconds, step = 30) => Math.floor(unixSeconds / step);
export const totp = (secret, unixSeconds, { step = 30, digits = 6 } = {}) => hotp(secret, counterAt(unixSeconds, step), digits).code;

/** Server-side check, accepting codes from `window` steps either side to tolerate clock drift. Returns the step offset or null. */
export function verify(secret, code, unixSeconds, { window = 1, step = 30, digits = 6 } = {}) {
  const c = counterAt(unixSeconds, step);
  for (let d = -window; d <= window; d++) if (hotp(secret, c + d, digits).code === code) return d;
  return null;
}

/** Base32 (RFC 4648), the format authenticator apps use for the shared secret. */
export function base32(bytes) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += A[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += A[(val << (5 - bits)) & 31];
  return out;
}
