import { test } from "node:test";
import assert from "node:assert/strict";
import { H, bitDiff, birthdayP, birthday50, findCollision } from "./hashing.js";

test("avalanche: one-character changes flip about half of the 160 bits", () => {
  let total = 0; const n = 200;
  for (let i = 0; i < n; i++) total += bitDiff(H("message " + i), H("message " + (i + 1)));
  const avg = total / n; assert.ok(avg > 72 && avg < 88, String(avg));
});

test("birthday maths: 23 people ≈ 50.7%", () => {
  assert.ok(Math.abs(birthdayP(23, 365) - 0.507) < 0.001);
  assert.ok(Math.abs(birthday50(365) - 22.49) < 0.05);
});

test("truncated-hash collisions show up near √N", () => {
  for (const bits of [16, 20, 24]) {
    let sum = 0; const runs = 12;
    for (let s = 1; s <= runs; s++) sum += findCollision(bits, s).tries;
    const avg = sum / runs, expect = Math.sqrt(Math.PI / 2 * 2 ** bits);
    assert.ok(avg > expect * 0.5 && avg < expect * 1.6, `${bits} bits: ${avg} vs ${expect}`);
  }
  const c = findCollision(20, 3); assert.notEqual(c.a, c.b);
});
