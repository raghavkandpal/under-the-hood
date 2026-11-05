import { test } from "node:test";
import assert from "node:assert/strict";
import { spread, avgRounds } from "../lib/gossip.js";
import { mulberry } from "../lib/autograd.js";

test("everyone hears the rumour, and the curve never goes down", () => {
  const r = spread({ n: 300, rnd: mulberry(1) }); assert.ok(r.done);
  for (let i = 1; i < r.curve.length; i++) assert.ok(r.curve[i] >= r.curve[i - 1]);
  assert.ok(r.when.every(w => w >= 0));
});

test("rounds grow like log n, not n", () => {
  const rnd = mulberry(2), a = avgRounds({ n: 100 }, 20, rnd), b = avgRounds({ n: 10000 }, 5, rnd);
  assert.ok(b < a * 3, `${a} vs ${b}`); assert.ok(b < 40);
});

test("push-pull finishes faster than push alone", () => {
  const rnd = mulberry(3); assert.ok(avgRounds({ n: 2000, mode: "pushpull" }, 10, rnd) < avgRounds({ n: 2000, mode: "push" }, 10, rnd));
});

test("robust to message loss and crashed nodes", () => {
  const r = spread({ n: 500, loss: 0.3, dead: 0.2, rnd: mulberry(4) }); assert.ok(r.done);
});
