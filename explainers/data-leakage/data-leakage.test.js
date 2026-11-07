import { test } from "node:test";
import assert from "node:assert/strict";
import { average } from "./data-leakage.js";
import { mulberry } from "../../shared/random.js";

test("honest: noise scores like a coin flip", () => {
  const a = average("honest", 40, mulberry(1)); assert.ok(Math.abs(a - 0.5) < 0.06, `${a}`);
});

test("choosing features on all the data first makes noise look predictive", () => {
  const a = average("leaky", 40, mulberry(2)); assert.ok(a > 0.75, `${a}`);
});

test("more candidate features, bigger illusion", () => {
  const few = average("leaky", 30, mulberry(3), { p: 30 }), many = average("leaky", 30, mulberry(4), { p: 2000 });
  assert.ok(many > few + 0.1, `${few} vs ${many}`);
});

test("duplicated rows in the test set inflate the score too", () => {
  const a = average("duplicates", 40, mulberry(5)); assert.ok(a > 0.55, `${a}`);
});
