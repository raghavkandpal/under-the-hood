import { test } from "node:test";
import assert from "node:assert/strict";
import { Naive, GapBuffer, PieceTable } from "../lib/textbuf.js";

test("all three buffers agree after a random edit session", () => {
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bufs = [new Naive("hello world"), new GapBuffer("hello world", 4), new PieceTable("hello world")];
  let ref = "hello world";
  for (let k = 0; k < 400; k++) {
    if (rnd() < 0.7 || !ref.length) { const pos = Math.floor(rnd() * (ref.length + 1)), t = "xyz".slice(0, 1 + Math.floor(rnd() * 3)); ref = ref.slice(0, pos) + t + ref.slice(pos); bufs.forEach(b => b.insert(pos, t)); }
    else { const pos = Math.floor(rnd() * ref.length), n = Math.min(1 + Math.floor(rnd() * 3), ref.length - pos); ref = ref.slice(0, pos) + ref.slice(pos + n); bufs.forEach(b => b.remove(pos, n)); }
    for (const b of bufs) assert.equal(b.text(), ref, b.constructor.name + " at step " + k);
  }
});

test("typing in one place is cheap for a gap buffer, expensive for an array", () => {
  const big = "x".repeat(10000), n = new Naive(big), g = new GapBuffer(big);
  for (let i = 0; i < 100; i++) { n.insert(10 + i, "a"); g.insert(10 + i, "a"); }
  assert.ok(n.moved > 900000);
  assert.ok(g.moved < 25000, `gap moved ${g.moved}`); // one gap move of ~10k, then a grow, then cheap
});

test("piece table never copies text and merges consecutive typing", () => {
  const p = new PieceTable("The cat sat.");
  for (const [i, c] of [..."big "].entries()) p.insert(4 + i, c);
  assert.equal(p.text(), "The big cat sat."); assert.equal(p.pieces.length, 3); assert.equal(p.moved, 0);
  assert.equal(p.orig, "The cat sat."); // original untouched
  p.remove(4, 4); assert.equal(p.text(), "The cat sat.");
});
