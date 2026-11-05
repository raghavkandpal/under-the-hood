import { test } from "node:test";
import assert from "node:assert/strict";
import { modPow, isPrime, safePrime, exchange, bruteForce, mixColor } from "./dh.js";
import { mulberry32 } from "./tcp.js";

test("modPow", () => {
  assert.equal(modPow(5, 6, 23), 8n);
  assert.equal(modPow(2, 100, 1000000007), 976371285n);
});

test("isPrime agrees with trial division below 5000", () => {
  const trial = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  for (let n = 0; n < 5000; n++) assert.equal(isPrime(n), trial(n), String(n));
  assert.ok(isPrime(2305843009213693951n)); // 2^61-1
  assert.ok(!isPrime(3215031751n));          // strong pseudoprime to 2,3,5,7
});

test("safe primes are safe and g generates the group", () => {
  const rnd = mulberry32(1);
  for (const bits of [8, 16, 24, 32, 48]) {
    const { p, q, g } = safePrime(bits, rnd);
    assert.equal(p.toString(2).length, bits);
    assert.ok(isPrime(p) && isPrime(q) && p === 2n * q + 1n);
    assert.notEqual(modPow(g, q, p), 1n);
    assert.notEqual(modPow(g, 2n, p), 1n);
  }
});

test("textbook exchange: both sides agree", () => {
  const r = exchange({ p: 23n, g: 5n, a: 6n, b: 15n });
  assert.equal(r.A, 8n); assert.equal(r.B, 19n);
  assert.equal(r.sAlice, 2n); assert.equal(r.sBob, 2n);
});

test("brute force recovers an exponent", () => {
  const { p, g } = safePrime(16, mulberry32(9));
  const a = 12345n % (p - 2n) + 1n, A = modPow(g, a, p);
  const it = bruteForce(g, A, p, 1000); let r;
  while (!(r = it.next()).done);
  assert.equal(modPow(g, r.value.x, p), A);
});

test("paint mixing is order-independent", () => {
  assert.equal(mixColor(["#ffd400", "#d0213a", "#1f6feb"]), mixColor(["#1f6feb", "#ffd400", "#d0213a"]));
});
