import { test } from "node:test";
import assert from "node:assert/strict";
import { pad, unpad, makeServer, attack, ivFor, K } from "./padding-oracle.js";
import { cbcDecrypt, cbcEncrypt } from "../../shared/cipher-modes.js";

const KEY = 0xC0FFEE, IV = 0x1234, MSG = "meet me at dawn", enc = s => new TextEncoder().encode(s), dec = b => new TextDecoder().decode(b);
const run = (msg = MSG, o = {}, iv = IV) => { const s = makeServer(KEY, o), m = s.encrypt(enc(msg), iv); return { s, m, r: attack(s.oracle, m.iv, m.ct, m.tag) }; };

test("padding: 7 bytes gets 0x01, 8 bytes gets a whole block 0x02 0x02", () => {
  assert.equal(K, 2);
  assert.deepEqual([...pad(Uint8Array.of(1, 2, 3))], [1, 2, 3, 1]);
  assert.deepEqual([...pad(Uint8Array.of(1, 2, 3, 4))], [1, 2, 3, 4, 2, 2]);
  assert.equal(pad(new Uint8Array(7)).length, 8); assert.equal(pad(new Uint8Array(8)).length, 10);
  for (const n of [0, 1, 7, 8]) { const m = Uint8Array.from({ length: n }, (_, i) => i + 5); assert.deepEqual(unpad(pad(m)), m); }
  assert.equal(unpad(Uint8Array.of(9, 9, 1, 2)), null);
  assert.equal(unpad(Uint8Array.of(9, 9, 9, 0)), null);
  assert.equal(unpad(Uint8Array.of(9, 9, 9, 3)), null);
  assert.deepEqual([...unpad(Uint8Array.of(9, 9, 2, 2))], [9, 9]);
});

test("XORing d into byte j of the previous block (or IV) XORs d into byte j of the next plaintext block", () => {
  const p = pad(enc(MSG)), ct = cbcEncrypt(p, KEY, IV), d = 0x5a;
  for (const j of [0, 1]) {
    const iv2 = IV ^ (d << (j ? 0 : 8)), out = cbcDecrypt(ct, KEY, iv2);
    assert.equal(out[j], p[j] ^ d); assert.deepEqual([...out.slice(2)], [...p.slice(2)]);
    assert.equal(out[1 - j], p[1 - j]);
    const ct2 = Uint8Array.from(ct); ct2[j] ^= d; const o2 = cbcDecrypt(ct2, KEY, IV);
    assert.equal(o2[2 + j], p[2 + j] ^ d); assert.equal(o2[2 + 1 - j], p[2 + 1 - j]);
  }
});

test("the attack recovers the whole message, first block included, from yes/no answers", () => {
  const { r } = run();
  assert.equal(dec(r.text), MSG);
  assert.deepEqual([...r.plain], [...pad(enc(MSG))]);
  assert.deepEqual([...r.answers].sort(), [false, true]);
  for (const msg of ["", "a", "ab", "hello", "x".repeat(8), "y".repeat(7)]) assert.equal(dec(run(msg).r.text), msg);
});

test("at most 256 guesses per byte plus one check per block; about 128 per byte on average", () => {
  for (const msg of ["", "a", MSG, "x".repeat(24)]) for (let iv = 0; iv < 300; iv += 61) {
    const { r } = run(msg, {}, iv), bytes = r.plain.length, blocks = bytes / 2;
    assert.ok(r.queries <= 256 * bytes + blocks, `${msg} ${iv}: ${r.queries}`);
  }
  let q = 0, n = 0;
  for (let iv = 0; iv < 2000; iv += 23) { const { r } = run("x".repeat(24), {}, iv); q += r.queries; n += r.plain.length; }
  const avg = q / n; assert.ok(avg > 124 && avg < 133, `average ${avg}`);
});

test("the printed run: default message and first IV on the page (seed 2)", () => {
  const { r } = run(MSG, {}, ivFor(2));
  assert.equal(MSG.length, 15); assert.equal(r.plain.length, 16);
  assert.equal(r.queries, r.perBlock.reduce((a, b) => a + b));
  assert.equal(r.queries, 2092); // pinned: the page prints this for the default message
  assert.equal(Math.round(r.queries / r.plain.length), 131);
});

test("a block whose first plaintext byte makes 0x02 0x02 pass by luck is still recovered", () => {
  // Choose the IV so the forged previous block [0, g] decrypts to 0x02 in byte 0; guess g = D1 ^ 2 then also passes.
  const s = makeServer(KEY), p0 = 0x41;
  for (let lo = 0; lo < 256; lo++) {
    const iv = ((p0 ^ 2) << 8) | lo, m = s.encrypt(enc("A"), iv), D = cbcDecrypt(m.ct.slice(0, 2), KEY, 0); // D = decrypt with zero IV
    assert.equal(D[0], 2);
    assert.ok(s.oracle(D[1] ^ 2, m.ct.slice(0, 2)), "false positive exists");
    const r = attack(s.oracle, m.iv, m.ct, m.tag);
    assert.equal(dec(r.text), "A");
    assert.ok(r.queries <= 256 * 2 + 1);
  }
});

test("the MAC fix: every tampered request gets the same answer and nothing is recovered", () => {
  const { r, s, m } = run(MSG, { mac: true });
  assert.deepEqual([...r.answers], [false]);
  assert.equal(r.plain.length, 0); assert.equal(r.text, null);
  assert.equal(r.queries, 256);
  assert.equal(s.oracle(m.iv, m.ct, m.tag), true); // the untouched message is still accepted
});
