import { test } from "node:test";
import assert from "node:assert/strict";
import { cost, attack } from "./timing-attacks.js";
import { mulberry } from "../../shared/random.js";

test("an early-exit compare costs more the more leading characters match; a constant-time one doesn't", () => {
  const secret = "c0ffee42";
  assert.deepEqual(["x0000000", "c0000000", "c0ff0000", "c0ffee42"].map(g => cost("early", secret, g)), [1, 3, 5, 8], "matches 0, 2, 4 and all 8 characters");
  assert.deepEqual(["x0000000", "c0ffee4x"].map(g => cost("constant", secret, g)), [8, 8]);
});

test("timing each guess many times recovers the secret a character at a time, in far fewer tries than brute force", () => {
  const r = attack({ secret: "c0ffee42", kind: "early", noise: 2, samples: 200, rnd: mulberry(1) });
  assert.equal(r.recovered, "c0ffee42"); assert.equal(r.requests, 8 * 16 * 200); assert.ok(r.requests < 16 ** 8 / 1000);
});

test("too few samples drown in noise; a constant-time compare leaks nothing at all", () => {
  assert.notEqual(attack({ secret: "c0ffee42", kind: "early", noise: 2, samples: 3, rnd: mulberry(2) }).recovered, "c0ffee42");
  assert.notEqual(attack({ secret: "c0ffee42", kind: "constant", noise: 2, samples: 500, rnd: mulberry(3) }).recovered, "c0ffee42");
});
