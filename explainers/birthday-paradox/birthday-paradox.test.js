import { test } from "node:test";
import assert from "node:assert/strict";
import { collision, approx, half, pairs, simulate, room } from "./birthday-paradox.js";
import { mulberry } from "../../shared/random.js";

test("23 people: just over a half; 70 people: 99.9%", () => {
  assert.ok(Math.abs(collision(23, 365) - 0.5073) < 1e-4); assert.ok(collision(22, 365) < 0.5);
  assert.ok(collision(70, 365) > 0.999); assert.equal(pairs(23), 253);
});

test("the approximation and the √N rule", () => {
  assert.ok(Math.abs(approx(23, 365) - collision(23, 365)) < 0.01);
  assert.ok(Math.abs(half(365) - 22.5) < 0.1);
  assert.ok(Math.abs(half(2 ** 32) / 77163 - 1) < 0.01, "32-bit hashes: about 77,000 items for even odds");
});

test("simulation agrees with the formula", () => {
  assert.ok(Math.abs(simulate(23, 365, 20000, mulberry(1)) - 0.507) < 0.015);
});

test("a room reports its first shared pair", () => {
  const r = room(60, 365, mulberry(2)); assert.ok(r.pair); assert.equal(r.days[r.pair[0]], r.days[r.pair[1]]);
  assert.equal(room(5, 1e9, mulberry(3)).pair, null);
});
