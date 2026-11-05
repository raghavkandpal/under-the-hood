import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, syndrome, transmit } from "../lib/hamming.js";

const all = Array.from({ length: 16 }, (_, n) => [3, 2, 1, 0].map(i => (n >> i) & 1));

test("clean codewords have syndrome 0 and decode exactly", () => {
  for (const d of all) { const c = encode(d); assert.equal(syndrome(c), 0); assert.deepEqual(decode(c).data, d); }
});

test("any single flipped bit is located and corrected", () => {
  for (const d of all) for (let pos = 1; pos <= 7; pos++) {
    const c = encode(d); c[pos - 1] ^= 1;
    const r = decode(c); assert.equal(r.syndrome, pos); assert.deepEqual(r.data, d);
  }
});

test("two flipped bits are detected but miscorrected", () => {
  const c = encode([1, 0, 1, 1]); c[0] ^= 1; c[5] ^= 1;
  const r = decode(c); assert.notEqual(r.syndrome, 0); assert.notDeepEqual(r.data, [1, 0, 1, 1]);
});

test("over a noisy channel, coding cuts the error rate a lot", () => {
  const t = transmit("The quick brown fox jumps over the lazy dog. ".repeat(10), 0.02, 3);
  assert.ok(t.codedBitErrors < t.rawBitErrors / 3, `${t.codedBitErrors} vs ${t.rawBitErrors}`);
  assert.equal(t.codedBits, t.sentBits * 7 / 4);
});
