import { test } from "node:test";
import assert from "node:assert/strict";
import { greedy, dp, calls } from "../lib/dp.js";

test("greedy is optimal for ordinary coins", () => {
  const C = [1, 2, 5, 10, 20, 50];
  for (let a = 1; a <= 200; a++) assert.equal(greedy(C, a).length, dp(C, a).coins.length, `amount ${a}`);
});

test("greedy fails for odd coin systems; DP doesn't", () => {
  assert.deepEqual(greedy([1, 3, 4], 6), [4, 1, 1]); assert.deepEqual(dp([1, 3, 4], 6).coins.sort(), [3, 3]);
  assert.equal(greedy([4, 7], 8), null); assert.deepEqual(dp([4, 7], 8).coins, [4, 4]);
  assert.equal(dp([4, 7], 5).coins, null);
});

test("DP coins add up and the table is consistent", () => {
  const r = dp([1, 5, 6, 9], 23); assert.equal(r.coins.reduce((a, b) => a + b), 23); assert.equal(r.coins.length, r.best[23]);
});

test("memoisation turns exponential into linear", () => {
  const c = calls([1, 3, 4], 30); assert.ok(c.plain > 100000); assert.ok(c.memo < 100);
});
