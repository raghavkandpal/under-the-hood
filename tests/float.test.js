import { test } from "node:test";
import assert from "node:assert/strict";
import { bits64, fromBits64, decompose, exactDecimal, nextUp, ulp, bits32, fromBits32 } from "../lib/float.js";

test("known bit patterns", () => {
  assert.equal(bits64(1), "0" + "01111111111" + "0".repeat(52));
  assert.equal(bits64(-2), "1" + "10000000000" + "0".repeat(52));
  assert.equal(bits32(0.5), "0" + "01111110" + "0".repeat(23));
});

test("round-trips", () => {
  for (const x of [0, -0, 1, 0.1, -3.75, 1e300, 5e-324, Math.PI, Infinity]) assert.ok(Object.is(fromBits64(bits64(x)), x), String(x));
  assert.equal(fromBits32(bits32(0.1)), Math.fround(0.1));
});

test("classification", () => {
  assert.equal(decompose(0).kind, "zero");
  assert.equal(decompose(5e-324).kind, "subnormal");
  assert.equal(decompose(Infinity).kind, "infinity");
  assert.equal(decompose(NaN).kind, "NaN");
  assert.equal(decompose(8).unbiased, 3);
});

test("exact decimal expansion of 0.1 and friends", () => {
  assert.equal(exactDecimal(0.1), "0.1000000000000000055511151231257827021181583404541015625");
  assert.equal(exactDecimal(0.5), "0.5");
  assert.equal(exactDecimal(2 ** 60), "1152921504606846976");
  assert.equal(exactDecimal(-0.25), "-0.25");
});

test("neighbours and ulp", () => {
  assert.equal(nextUp(1) - 1, Number.EPSILON);
  assert.equal(ulp(2 ** 53), 2);
  assert.equal(nextUp(0), 5e-324);
  assert.ok(nextUp(-1) > -1);
});
