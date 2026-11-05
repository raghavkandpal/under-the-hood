import { test } from "node:test";
import assert from "node:assert/strict";
import { egcd, modInv, keygen, sign, verify, factor } from "../lib/rsa.js";
import { modPow } from "../lib/dh.js";
import { mulberry } from "../lib/autograd.js";

test("egcd and modInv", () => {
  const [g, x, y] = egcd(240n, 46n);
  assert.equal(g, 2n); assert.equal(240n * x + 46n * y, 2n);
  assert.equal(modInv(17n, 3120n), 2753n); // textbook RSA example
});

test("textbook RSA (p=61, q=53)", () => {
  const n = 3233n, e = 17n, d = 2753n;
  assert.equal(modPow(65n, e, n), 2790n);
  assert.equal(modPow(2790n, d, n), 65n);
});

test("sign/verify round-trip; tampering and wrong key fail", () => {
  const rnd = mulberry(7);
  for (const bits of [24, 40, 64]) {
    const k = keygen(bits, rnd), other = keygen(bits, rnd);
    const s = sign("pay alice 10", k);
    assert.ok(verify("pay alice 10", s, k));
    assert.ok(!verify("pay alice 1000", s, k), "tamper detected");
    assert.ok(!verify("pay alice 10", s, other));
    assert.equal((k.e * k.d) % k.phi, 1n);
  }
});

test("factoring a small modulus recovers the key", () => {
  const k = keygen(32, mulberry(3)), it = factor(k.n);
  let r; while (!(r = it.next()).done);
  const { p, q } = r.value;
  assert.equal(p * q, k.n);
  assert.ok((p === k.p && q === k.q) || (p === k.q && q === k.p));
});
