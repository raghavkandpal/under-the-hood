import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, sizeBits, rawBits } from "../lib/lz77.js";
import { mulberry } from "../lib/autograd.js";

test("round-trips many inputs and window sizes", () => {
  const r = mulberry(4), rand = n => Array.from({ length: n }, () => "abcde"[Math.floor(r() * 5)]).join("");
  const inputs = ["", "a", "abcabcabcabc", "aaaaaaaaaaaaaaaaaaaa", "to be or not to be, that is the question", "héllo héllo 🎉🎉🎉🎉", rand(500)];
  for (const s of inputs) for (const window of [4, 16, 4096]) assert.equal(decode(encode(s, { window })), s, `${s.slice(0, 20)} w=${window}`);
});

test("overlapping matches compress runs", () => {
  const t = encode("aaaaaaaaaa");
  assert.equal(t.length, 2);
  assert.deepEqual([t[1].dist, t[1].len], [1, 9]);
});

test("repetitive text shrinks, random text doesn't", () => {
  const rep = "the cat sat on the mat. ".repeat(20), r = mulberry(9);
  const rnd = Array.from({ length: rep.length }, () => String.fromCharCode(33 + Math.floor(r() * 90))).join("");
  assert.ok(sizeBits(encode(rep)) < rawBits(rep) * 0.25);
  assert.ok(sizeBits(encode(rnd)) > rawBits(rnd));
});

test("a small window can't see far-back repeats", () => {
  const s = "abcdefghij" + "x".repeat(40) + "abcdefghij";
  const far = encode(s, { window: 4096 }).filter(t => t.dist > 40), near = encode(s, { window: 16 }).filter(t => t.dist > 40);
  assert.ok(far.length >= 1 && near.length === 0);
});
