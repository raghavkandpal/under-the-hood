import { test } from "node:test";
import assert from "node:assert/strict";
import { bisect } from "./bisect.js";

test("finds the first bad commit in at most ⌈log2 n⌉ tests", () => {
  for (const n of [2, 10, 100, 1000]) for (const bad of [1, Math.max(1, Math.floor(n / 3)), n - 1]) {
    const r = bisect(n, i => i >= bad);
    assert.equal(r.found, bad, `n=${n} bad=${bad}`); assert.ok(r.steps.length <= Math.ceil(Math.log2(n)), `n=${n}: ${r.steps.length}`);
  }
});

test("commits that can't be tested are skipped, and bisect still converges", () => {
  const r = bisect(100, i => (i % 7 === 3 ? "skip" : i >= 40));
  assert.equal(r.found, 40); assert.ok(r.steps.some(s => s.result === "skip"));
});

test("if the commits next to the culprit can't be tested, it narrows to a range instead", () => {
  const r = bisect(20, i => (i >= 8 && i <= 10 ? "skip" : i >= 10));
  assert.equal(r.found, null); assert.deepEqual(r.candidates, [8, 9, 10, 11], "11 is known bad, but any of the skipped ones could be first");
});
