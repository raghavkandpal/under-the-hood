import { test } from "node:test";
import assert from "node:assert/strict";
import { hmacSha1, hotp, totp, verify, base32, textBytes } from "../lib/totp.js";

const SECRET = textBytes("12345678901234567890"); // the RFC test secret
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");

test("HMAC-SHA1 matches RFC 2202 test case 2", () => {
  assert.equal(hex(hmacSha1(textBytes("Jefe"), textBytes("what do ya want for nothing?"))), "effcdf6ae5eb2fa2d27416d5f184df9c259a7c79");
});

test("HOTP matches the RFC 4226 test vectors", () => {
  const want = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  want.forEach((code, c) => assert.equal(hotp(SECRET, c).code, code));
});

test("TOTP matches the RFC 6238 SHA-1 test vectors (8 digits)", () => {
  const cases = [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]];
  for (const [t, code] of cases) assert.equal(totp(SECRET, t, { digits: 8 }), code);
});

test("the code changes every 30 seconds and the server tolerates one step of drift", () => {
  const t = 1700000010, code = totp(SECRET, t);
  assert.equal(totp(SECRET, t + 15), code); assert.notEqual(totp(SECRET, t + 30), code);
  assert.equal(verify(SECRET, code, t + 30), -1); assert.equal(verify(SECRET, code, t), 0); assert.equal(verify(SECRET, code, t + 90), null);
});

test("base32 encodes the secret the way authenticator apps expect", () => {
  assert.equal(base32(textBytes("foobar")), "MZXW6YTBOI"); assert.equal(base32(SECRET), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
});
