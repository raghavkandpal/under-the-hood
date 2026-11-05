import { test } from "node:test";
import assert from "node:assert/strict";
import { analyse, EXAMPLES } from "./simpson.js";

test("kidney-stone data shows the paradox", () => {
  const r = analyse(EXAMPLES.stones);
  assert.deepEqual(r.groupWinners, [0, 0]); assert.equal(r.overall, 1); assert.ok(r.paradox);
  assert.ok(Math.abs(r.tot[0].r - 273 / 350) < 1e-12 && Math.abs(r.tot[1].r - 289 / 350) < 1e-12);
});

test("course example shows it too; balanced groups don't", () => {
  assert.ok(analyse(EXAMPLES.courses).paradox);
  const balanced = { ...EXAMPLES.courses, cells: [[{ s: 30, n: 60 }, { s: 15, n: 60 }], [{ s: 54, n: 60 }, { s: 51, n: 60 }]] };
  assert.ok(!analyse(balanced).paradox);
});
