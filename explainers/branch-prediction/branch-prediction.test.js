import { test } from "node:test";
import assert from "node:assert/strict";
import { run, PATTERNS } from "./branch-prediction.js";
import { mulberry } from "../../shared/random.js";

const miss = (kind, pattern, n = 4000) => run(kind, PATTERNS[pattern](n, mulberry(1))).missRate;

test("sorted data is almost free; random data misses half the time", () => {
  for (const k of ["oneBit", "twoBit", "history"]) assert.ok(miss(k, "sorted") < 0.002, k);
  assert.ok(Math.abs(miss("twoBit", "random") - 0.5) < 0.04, `${miss("twoBit", "random")}`);
});

test("a loop of 8: one bit misses twice per loop, two bits once, history learns it", () => {
  assert.ok(Math.abs(miss("oneBit", "loop") - 2 / 8) < 0.01); assert.ok(Math.abs(miss("twoBit", "loop") - 1 / 8) < 0.01);
  assert.ok(run("history", PATTERNS.loop(4000), 4).missRate > 0.1, "4 bits of history can't see a period of 8");
  assert.ok(miss("history", "loop") < 0.01, "8 bits can");
});

test("alternating: counters are fooled every time, history gets it after warm-up", () => {
  assert.ok(miss("oneBit", "alternating") > 0.999, "every guess but the first"); assert.ok(miss("twoBit", "alternating") >= 0.5);
  assert.ok(miss("history", "alternating") < 0.01);
});
