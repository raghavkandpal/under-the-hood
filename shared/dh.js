// Diffie-Hellman over small safe primes, with BigInt. Educational sizes only. No DOM.

export function modPow(base, exp, mod) {
  base = BigInt(base) % BigInt(mod); exp = BigInt(exp); mod = BigInt(mod);
  let r = 1n;
  while (exp > 0n) { if (exp & 1n) r = (r * base) % mod; base = (base * base) % mod; exp >>= 1n; }
  return r;
}

// Deterministic Miller-Rabin for n < 3.3e24 with these bases.
const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
export function isPrime(n) {
  n = BigInt(n);
  if (n < 2n) return false;
  for (const p of MR_BASES) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0; while ((d & 1n) === 0n) { d >>= 1n; s++; }
  outer: for (const a of MR_BASES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) { x = (x * x) % n; if (x === n - 1n) continue outer; }
    return false;
  }
  return true;
}

export function randomBigBelow(n, rnd = Math.random) {
  // uniform-ish in [0, n)
  const bits = n.toString(2).length;
  for (;;) {
    let x = 0n;
    for (let i = 0; i < bits; i += 30) x = (x << 30n) | BigInt(Math.floor(rnd() * 2 ** 30));
    x &= (1n << BigInt(bits)) - 1n;
    if (x < n) return x;
  }
}

/** A safe prime p = 2q + 1 with the given bit length, and a generator g of the full group. */
export function safePrime(bits, rnd = Math.random) {
  if (bits < 5) bits = 5;
  for (let tries = 0; tries < 200000; tries++) {
    const top = 1n << BigInt(bits - 2);
    let q = top | randomBigBelow(top, rnd) | 1n;          // q has bits-1 bits, odd
    if (!isPrime(q)) continue;
    const p = 2n * q + 1n;
    if (!isPrime(p)) continue;
    for (let g = 2n; g < p; g++) if (modPow(g, 2n, p) !== 1n && modPow(g, q, p) !== 1n) return { p, q, g };
  }
  throw new Error("no safe prime found");
}

export function exchange({ p, g, a, b }) {
  const A = modPow(g, a, p), B = modPow(g, b, p);
  return { A, B, sAlice: modPow(B, a, p), sBob: modPow(A, b, p) };
}

/** Brute-force discrete log: smallest x with g^x = target (mod p). Yields progress so a UI can stay responsive. */
export function* bruteForce(g, target, p, chunk = 50000) {
  let x = 0n, cur = 1n;
  const G = BigInt(g), T = BigInt(target), P = BigInt(p);
  for (;;) {
    for (let i = 0; i < chunk; i++) {
      if (cur === T) return { x, tries: x + 1n };
      cur = (cur * G) % P; x++;
      if (x >= P) return { x: null, tries: x };
    }
    yield x;
  }
}

// ---- paint analogy: a mixture is a bag of ingredients; its colour is their average ----
export function mixColor(ingredients) {
  const n = ingredients.length;
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const gam = c => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  const sum = [0, 0, 0];
  for (const hex of ingredients) {
    const v = parseInt(hex.slice(1), 16);
    [(v >> 16) & 255, (v >> 8) & 255, v & 255].forEach((c, i) => sum[i] += lin(c));
  }
  return "#" + sum.map(s => gam(s / n).toString(16).padStart(2, "0")).join("");
}
