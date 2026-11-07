import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./failure-detection.js";
import { mulberry } from "../../shared/random.js";

test("a short timeout notices a crash quickly but wrongly declares healthy servers dead", () => {
  const short = simulate({ timeout: 1.2, rnd: mulberry(1) }), long = simulate({ timeout: 4, rnd: mulberry(1) });
  assert.ok(short.detectAfter < long.detectAfter, `${short.detectAfter} vs ${long.detectAfter}`);
  assert.ok(short.falseAlarms > long.falseAlarms, `${short.falseAlarms} vs ${long.falseAlarms}`);
});

test("the phi detector adapts: one setting is quick on a calm network and patient on a jittery one", () => {
  const calm = simulate({ phi: 8, jitter: 0.15, rnd: mulberry(1) }), jittery = simulate({ phi: 8, jitter: 0.6, rnd: mulberry(1) });
  assert.ok(calm.detectAfter < jittery.detectAfter, `${calm.detectAfter} vs ${jittery.detectAfter}`);
  const fixed = simulate({ timeout: 1.5, jitter: 0.6, rnd: mulberry(1) });
  assert.ok(jittery.falseAlarms < fixed.falseAlarms / 10, `${jittery.falseAlarms} vs ${fixed.falseAlarms}`);
});

test("lost heartbeats are what a long-enough timeout has to absorb", () => {
  const r = simulate({ timeout: 1.5, jitter: 0.05, loss: 0.1, rnd: mulberry(2) });
  assert.ok(r.falseAlarms > 30, `${r.falseAlarms}`); assert.equal(simulate({ timeout: 2.5, jitter: 0.05, loss: 0, rnd: mulberry(2) }).falseAlarms, 0);
});

test("with no jitter or loss, the numbers are exact", () => {
  const r = simulate({ timeout: 1.5, jitter: 0, loss: 0, rnd: mulberry(3) });
  assert.equal(r.falseAlarms, 0); assert.ok(Math.abs(r.detectAfter - 0.55) < 1e-9, "last beat at 599.05 s, plus 1.5 s, minus the crash at 600 s");
});
