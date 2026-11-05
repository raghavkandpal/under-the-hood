// Toy RSA key generation, signing and verification with BigInt. Educational sizes only. No DOM.
import { modPow, isPrime, randomBigBelow } from "./dh.js";
import { sha1 } from "./git.js";

export function egcd(a, b) { // returns [g, x, y] with ax + by = g
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
  while (r1 !== 0n) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; [t0, t1] = [t1, t0 - q * t1]; }
  return [r0, s0, t0];
}
export function modInv(a, m) { const [g, x] = egcd(((a % m) + m) % m, m); if (g !== 1n) throw new Error("no inverse"); return ((x % m) + m) % m; }

export function randomPrime(bits, rnd = Math.random) {
  for (;;) { const top = 1n << BigInt(bits - 1); const c = top | randomBigBelow(top, rnd) | 1n; if (isPrime(c)) return c; }
}

export function keygen(bits = 32, rnd = Math.random, e = 65537n) {
  for (;;) {
    const p = randomPrime(Math.ceil(bits / 2), rnd), q = randomPrime(Math.floor(bits / 2), rnd);
    if (p === q) continue;
    const n = p * q, phi = (p - 1n) * (q - 1n);
    if (egcd(e, phi)[0] !== 1n) continue;
    return { p, q, n, e, d: modInv(e, phi), phi };
  }
}

/** Hash a message to a number below n (SHA-1, truncated). Real schemes use padding like RSA-PSS. */
export function digest(msg, n) {
  const h = sha1(new TextEncoder().encode(msg));
  return BigInt("0x" + h) % n;
}
export const sign = (msg, { d, n }) => modPow(digest(msg, n), d, n);
export const verify = (msg, sig, { e, n }) => modPow(BigInt(sig), e, n) === digest(msg, n);

/** Brute-force factor by trial division, as a generator so a UI can stay responsive. */
export function* factor(n, chunk = 20000n) {
  if (n % 2n === 0n) return { p: 2n, q: n / 2n, tried: 1n };
  let d = 3n, tried = 0n;
  for (;;) {
    const stop = d + chunk * 2n;
    for (; d < stop; d += 2n) { tried++; if (d * d > n) return null; if (n % d === 0n) return { p: d, q: n / d, tried }; }
    yield { d, tried };
  }
}
