import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCipher, ecbEncrypt, ecbDecrypt, cbcEncrypt, cbcDecrypt, ctr, xor, flipBit, repeatedBlocks } from "../lib/cipher-modes.js";

const msg = Uint8Array.from("ATTACK AT DAWN!!ATTACK AT DAWN!!", c => c.charCodeAt(0)), KEY = 0xC0FFEE;
const diffBytes = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0);

test("the block cipher is a permutation and decrypts", () => {
  const c = makeCipher(KEY), seen = new Set();
  for (let b = 0; b < 65536; b++) { const e = c.enc(b); seen.add(e); assert.equal(c.dec(e), b); }
  assert.equal(seen.size, 65536);
});

test("every mode round-trips", () => {
  assert.deepEqual(ecbDecrypt(ecbEncrypt(msg, KEY), KEY), msg);
  assert.deepEqual(cbcDecrypt(cbcEncrypt(msg, KEY, 1234), KEY, 1234), msg);
  assert.deepEqual(ctr(ctr(msg, KEY, 77), KEY, 77), msg);
});

test("ECB leaks repetition; CBC and CTR hide it", () => {
  assert.ok(repeatedBlocks(ecbEncrypt(msg, KEY)) >= 0.5);
  assert.ok(repeatedBlocks(cbcEncrypt(msg, KEY, 9)) < 0.2); assert.ok(repeatedBlocks(ctr(msg, KEY, 9)) < 0.2);
});

test("one flipped ciphertext bit: CTR damages one bit, CBC one block plus one bit, ECB one block", () => {
  const i = 6;
  assert.equal(diffBytes(ctr(flipBit(ctr(msg, KEY, 5), i), KEY, 5), msg), 1);
  const cb = cbcDecrypt(flipBit(cbcEncrypt(msg, KEY, 5), i), KEY, 5), d = diffBytes(cb, msg);
  assert.ok(d >= 2 && d <= 3, `cbc changed ${d} bytes`);
  assert.ok(diffBytes(ecbDecrypt(flipBit(ecbEncrypt(msg, KEY), i), KEY), msg) <= 2);
});

test("reusing a CTR nonce leaks the XOR of the two plaintexts", () => {
  const other = Uint8Array.from("RETREAT AT DUSK!RETREAT AT DUSK!", c => c.charCodeAt(0));
  assert.deepEqual(xor(ctr(msg, KEY, 3), ctr(other, KEY, 3)), xor(msg, other));
  assert.notDeepEqual(xor(ctr(msg, KEY, 3), ctr(other, KEY, 4)), xor(msg, other));
});
