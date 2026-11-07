import { test } from "node:test";
import assert from "node:assert/strict";
import { phi, quantile } from "./normal.js";

test("known values of the normal distribution", () => {
  assert.ok(Math.abs(phi(1.959964) - 0.975) < 1e-6); assert.ok(Math.abs(phi(0) - 0.5) < 2e-7, "within the approximation's error");
  assert.ok(Math.abs(quantile(0.975) - 1.959964) < 1e-4); assert.ok(Math.abs(quantile(0.8) - 0.841621) < 1e-4);
});
