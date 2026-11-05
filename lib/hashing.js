// Cryptographic hash properties: avalanche effect and birthday collisions on truncated hashes. Uses lib/git.js SHA-1 (sync). No DOM.
import { sha1 } from "./git.js";
import { mulberry } from "./autograd.js";

const enc = new TextEncoder();
export const H = s => sha1(enc.encode(s));
export const toBits = hex => [...hex].flatMap(c => parseInt(c, 16).toString(2).padStart(4, "0").split("").map(Number));
export const bitDiff = (a, b) => toBits(a).reduce((s, x, i) => s + (x !== toBits(b)[i]), 0);

/** Probability of at least one collision among n random values from a space of size N. */
export const birthdayP = (n, N) => { let p = 1; for (let i = 0; i < n; i++) p *= 1 - i / N; return 1 - p; };
/** n where collision chance reaches ~50%: about 1.1774·√N. */
export const birthday50 = N => Math.sqrt(2 * N * Math.LN2);

/** Hash random strings, truncated to `bits` bits, until two collide. Returns tries and the colliding pair. */
export function findCollision(bits, seed = 1, limit = 5e6) {
  const r = mulberry(seed), seen = new Map(), hexDigits = Math.ceil(bits / 4), mask = (1 << (bits % 4 || 4)) - 1;
  for (let i = 1; i <= limit; i++) {
    const s = "msg-" + Math.floor(r() * 1e12).toString(36) + "-" + i;
    let h = H(s).slice(0, hexDigits);
    if (bits % 4) h = h.slice(0, -1) + (parseInt(h.at(-1), 16) & mask).toString(16);
    if (seen.has(h)) return { tries: i, a: seen.get(h), b: s, hash: h };
    seen.set(h, s);
  }
  return null;
}
