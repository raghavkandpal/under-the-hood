import { test } from "node:test";
import assert from "node:assert/strict";
import { lcsTable, diff, apply, stats, hunks } from "./diff.js";
import { mulberry } from "./random.js";

test("LCS lengths", () => {
  assert.equal(lcsTable([..."ABCBDAB"], [..."BDCABA"])[0][0], 4);
  assert.equal(lcsTable([], [..."abc"])[0][0], 0);
});

test("applying the script turns a into b, and it's minimal", () => {
  const r = mulberry(3);
  for (let t = 0; t < 200; t++) {
    const mk = () => Array.from({ length: Math.floor(r() * 12) }, () => "abcd"[Math.floor(r() * 4)]);
    const a = mk(), b = mk(), s = diff(a, b);
    assert.deepEqual(apply(a, s), b);
    const L = lcsTable(a, b)[0][0], st = stats(s);
    assert.equal(st.same, L); assert.equal(st.del, a.length - L); assert.equal(st.ins, b.length - L);
  }
});

test("hunks carry correct headers", () => {
  const a = ["a", "b", "c", "d", "e", "f", "g", "h"], b = ["a", "b", "X", "d", "e", "f", "g", "h", "i"];
  const h = hunks(diff(a, b), 1);
  assert.equal(h.length, 2);
  assert.equal(h[0].header, "@@ -2,3 +2,3 @@");
});
