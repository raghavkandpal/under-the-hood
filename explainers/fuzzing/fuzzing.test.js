import { test } from "node:test";
import assert from "node:assert/strict";
import { target, fuzz, mutate, show } from "./fuzzing.js";
import { mulberry } from "../../shared/random.js";

test("the bug: FUZ! with a length byte over 200", () => {
  assert.ok(target([70, 85, 90, 33, 250]).crash); assert.ok(!target([70, 85, 90, 33, 100]).crash); assert.ok(!target([70, 85, 90]).crash);
  assert.equal(target([70, 85, 0, 0, 0]).cov.size, 4);
});

test("coverage guidance finds it in a few thousand runs; random inputs don't in 20,000", () => {
  for (let s = 1; s <= 5; s++) { const g = fuzz({ guided: true, rnd: mulberry(s) }); assert.ok(g.crash && g.crash.at < 20000, `seed ${s}`); assert.equal(show(g.crash.input).slice(0, 4), "FUZ!"); }
  for (let s = 1; s <= 5; s++) assert.equal(fuzz({ guided: false, rnd: mulberry(s) }).crash, null);
});

test("each corpus entry reached a branch nobody had reached before", () => {
  const g = fuzz({ guided: true, rnd: mulberry(9) }), all = g.corpus.flatMap(c => c.found);
  assert.equal(all.length, new Set(all).size); assert.equal(g.covered, 7);
  assert.notDeepEqual(mutate([1, 2, 3], mulberry(1)), [1, 2, 3]);
});
