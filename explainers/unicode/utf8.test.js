import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, encodeCP, utf16, mojibake } from "./utf8.js";

const samples = ["hello", "café", "naïve résumé", "日本語", "👍🏽", "👨‍👩‍👧", "𝄞 music", "Ω≈ç√∫"];

test("encoder matches TextEncoder", () => {
  for (const s of samples) assert.deepEqual(encode(s), [...new TextEncoder().encode(s)], s);
});

test("decoder round-trips and matches TextDecoder", () => {
  for (const s of samples) { const r = decode(encode(s)); assert.equal(r.text, s); assert.equal(r.errors.length, 0); }
});

test("invalid input is flagged like TextDecoder replaces it", () => {
  const bad = [[0x80], [0xc3], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xff, 0x41]];
  for (const b of bad) { const r = decode(b); assert.ok(r.errors.length > 0, JSON.stringify(b)); assert.ok(r.text.includes("�")); }
  assert.equal(decode([0xc0, 0xaf]).errors[0].why, "overlong encoding");
});

test("byte lengths and UTF-16 surrogates", () => {
  assert.deepEqual([0x41, 0xe9, 0x20ac, 0x1f44d].map(c => encodeCP(c).length), [1, 2, 3, 4]);
  assert.deepEqual(utf16(0x1f44d), [0xd83d, 0xdc4d]);
  assert.throws(() => encodeCP(0xd800));
});

test("mojibake of é", () => { assert.equal(mojibake(encode("café")), "cafÃ©"); });
