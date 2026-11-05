import { test } from "node:test";
import assert from "node:assert/strict";
import { toSigned, fromSigned, add, negate, bitsOf, OPS, toUnsigned } from "../lib/bits.js";

test("8-bit two's complement interpretations", () => {
  assert.equal(toSigned(0xff, 8), -1); assert.equal(toSigned(0x80, 8), -128); assert.equal(toSigned(0x7f, 8), 127);
  assert.equal(fromSigned(-5, 8), 0xfb); assert.deepEqual(bitsOf(5, 8), [0, 0, 0, 0, 0, 1, 0, 1]);
  for (let s = -128; s < 128; s++) assert.equal(toSigned(fromSigned(s, 8), 8), s);
});

test("negation is invert-and-add-one, and -(-128) wraps to -128", () => {
  for (let s = -127; s < 128; s++) assert.equal(toSigned(negate(fromSigned(s, 8), 8), 8), -s || 0); // -0 → 0
  assert.equal(toSigned(negate(0x80, 8), 8), -128);
});

test("addition matches modular arithmetic and flags overflow correctly", () => {
  for (let a = 0; a < 256; a += 7) for (let b = 0; b < 256; b += 11) {
    const r = add(a, b, 8); assert.equal(r.result, (a + b) & 0xff); assert.equal(r.carryOut, a + b > 255 ? 1 : 0);
    const s = toSigned(a, 8) + toSigned(b, 8); assert.equal(r.signedOverflow, s > 127 || s < -128);
  }
  assert.ok(add(fromSigned(100, 8), fromSigned(100, 8), 8).signedOverflow); // 100+100 = -56 in 8 bits
});

test("bitwise ops", () => {
  assert.equal(OPS.and.f(0b1100, 0b1010), 0b1000); assert.equal(OPS.xor.f(0b1100, 0b1010), 0b0110);
  assert.equal(toSigned(toUnsigned(OPS.shr.f(fromSigned(-8, 8), 0, 8), 8), 8), -4);
  assert.equal(OPS.ushr.f(0xf0), 0x78);
});
