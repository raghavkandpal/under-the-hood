import { test } from "node:test";
import assert from "node:assert/strict";
import { naive, kmp, horspool, failure } from "./string-search.js";

test("the failure table", () => {
  assert.deepEqual(failure("ababaca"), [0, 0, 1, 2, 3, 0, 1]); assert.deepEqual(failure("aaaa"), [0, 1, 2, 3]);
});

test("all three find the same matches, overlapping ones included", () => {
  for (const [t, p] of [["abababab", "abab"], ["the cat sat on the mat", "at"], ["aaaaa", "aa"], ["hello", "xyz"], ["a", "a"]]) {
    const want = naive(t, p).matches; assert.deepEqual(kmp(t, p).matches, want, `${t}/${p}`); assert.deepEqual(horspool(t, p).matches, want, `${t}/${p}`);
  }
});

test("worst case for naive: n·m comparisons; KMP stays under 2n", () => {
  const text = "a".repeat(1000), pat = "a".repeat(9) + "b";
  assert.equal(naive(text, pat).comparisons, 991 * 10); assert.ok(kmp(text, pat).comparisons < 2000, `${kmp(text, pat).comparisons}`);
});

test("Horspool reads far fewer characters than the text has, for long patterns over a wide alphabet", () => {
  const text = "pack my box with five dozen liquor jugs and then sphinx of black quartz judge my vow ".repeat(20), pat = "black quartz";
  const h = horspool(text, pat); assert.ok(h.comparisons < text.length / 4, `${h.comparisons} of ${text.length}`);
  assert.ok(naive(text, pat).comparisons > text.length);
});

test("traces: one row per alignment, and every match ends in an all-green row", () => {
  const r = kmp("abcabd", "abd"); assert.deepEqual(r.matches, [3]);
  assert.ok(r.trace.some(row => row.shift === 3 && row.cells.length === 3 && row.cells.every(c => c.ok)));
});
