import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha1 } from "../../shared/git.js";
import { textBytes } from "../../shared/totp.js";
import { SECRET, MESSAGE, SUFFIX, pad, stateOf, mac, hmac, resume, roleOf, makeServer, forge, crack, show, view } from "./length-extension.js";

const m = textBytes(MESSAGE), tag = mac(SECRET, m);
const real = b => createHash("sha1").update(b).digest("hex");
const cat = (...p) => Buffer.concat(p.map(x => Buffer.from(x)));

test("sha1 with its default arguments still matches real SHA-1, and the explicit initial state changes nothing", () => {
  assert.equal(sha1(textBytes("abc")), real("abc"));
  assert.equal(sha1(textBytes("")), real(""));
  const iv = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  assert.equal(sha1(textBytes("abc"), { state: iv, count: 0 }), real("abc"));
});

test("fact 1: padding is 0x80, zeros, then the 8-byte bit length, up to a multiple of 64 bytes", () => {
  for (const [len, total] of [[55, 64], [56, 128], [64, 128]]) {
    const p = pad(len);
    assert.equal(len + p.length, total);
    assert.equal(p[0], 0x80);
    assert.deepEqual([...p.slice(-8)], [0, 0, 0, 0, ...new Uint8Array(new Uint32Array([len * 8]).buffer).reverse()]);
    assert.ok(p.slice(1, -8).every(b => b === 0));
  }
  assert.equal(pad(20 + 16).length, 28); // the page's message with its 16-byte secret
});

test("fact 2: resuming from sha1(m)'s five words gives sha1(m || pad(m) || x)", () => {
  for (const len of [0, 3, 20, 55, 56, 64, 100, 130]) for (const x of ["", "&role=admin", "x".repeat(70)]) {
    const mm = Uint8Array.from({ length: len }, (_, i) => (i * 31 + 7) & 255);
    assert.equal(resume(real(mm), len, textBytes(x)), real(cat(mm, pad(len), textBytes(x))), `len ${len} x ${x.length}`);
  }
});

test("fact 3: with only message, MAC, key length 16 and suffix, the forgery is accepted and the role is admin", () => {
  assert.equal(SECRET.length, 16);
  assert.equal(roleOf(m), "user");
  const f = forge(MESSAGE, tag, 16, SUFFIX), server = makeServer(SECRET);
  assert.equal(server.check(f.message, f.mac), true);
  assert.equal(roleOf(f.message), "admin");
  assert.equal(f.mac, mac(SECRET, f.message));
  assert.equal(f.message.length, 59);
  assert.equal(f.mac, "587458ff8db182225c56f964af974f414ef23da4");
  assert.notEqual(f.mac, tag);
});

test("fact 4: without the length, 1, 2, 3 … first succeeds at 16, after 16 queries", () => {
  const server = makeServer(SECRET), r = crack(server, m, tag, SUFFIX);
  assert.equal(r.keyLen, 16);
  assert.equal(r.queries, 16);
  assert.equal(server.queries, 16);
  assert.equal(roleOf(r.forged.message), "admin");
});

test("fact 5: against HMAC-SHA1 the same forgery fails for every guessed length 1 to 64", () => {
  const server = makeServer(SECRET, hmac), t = hmac(SECRET, m);
  for (let k = 1; k <= 64; k++) { const f = forge(m, t, k, SUFFIX); assert.equal(server.check(f.message, f.mac), false, `k=${k}`); }
  assert.equal(server.queries, 64);
  assert.equal(crack(makeServer(SECRET, hmac), m, t, SUFFIX).keyLen, null);
});

test("the page's view: every displayed value follows its inputs", () => {
  const a = view("sha1", 16, false);
  assert.deepEqual([a.accepted, a.role, a.padBytes, a.forgedLength, a.search], [true, "admin", 28, 59, null]);
  assert.equal(a.tag, tag);
  assert.equal(a.forgedMessage, "user=alice&role=user" + "%80" + "%00".repeat(25) + "%01%20&role=admin");
  const b = view("sha1", 15, false);  // wrong length: rejected, no role, one more padding byte
  assert.deepEqual([b.accepted, b.role, b.padBytes, b.forgedLength], [false, null, 29, 60]);
  assert.equal(b.forgedMac, a.forgedMac);           // same block count (64 bytes), so the same MAC; only the message differs
  assert.notEqual(view("sha1", 50, false).forgedMac, a.forgedMac);  // 70 bytes pad to 128: another block
  assert.notEqual(b.forgedMessage, a.forgedMessage);
  assert.deepEqual(view("sha1", 5, true).search, { keyLen: 16, queries: 16 });  // the search does not depend on the guess
  const h = view("hmac", 16, true);
  assert.deepEqual([h.accepted, h.role, h.search], [false, null, { keyLen: null, queries: 64 }]);
  assert.notEqual(h.tag, tag);                       // switching the MAC redraws the tag
  assert.equal(view("hmac", 16, false).search, null); // a control change clears the search result
});

test("show leaves printable bytes and escapes the rest", () => {
  assert.equal(show(Uint8Array.of(97, 0x80, 37, 32)), "a%80%25%20");
});
