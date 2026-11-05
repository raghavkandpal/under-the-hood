import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAMS, Machine, explore } from "./concurrency.js";

test("unlocked count++ has 20 interleavings and can lose an update", () => {
  const r = explore(PROGRAMS.race);
  assert.equal(r.schedules, 20); // C(6,3)
  const keys = r.outcomes.map(o => o.k).sort();
  assert.deepEqual(keys, ['{"count":1}', '{"count":2}']);
});

test("with a lock, every interleaving gives 2", () => {
  const r = explore(PROGRAMS.locked);
  assert.deepEqual(r.outcomes.map(o => o.k), ['{"count":2}']);
});

test("opposite lock order can deadlock; same order never does", () => {
  assert.ok(explore(PROGRAMS.deadlock).outcomes.some(o => o.k === "deadlock"));
  assert.ok(!explore(PROGRAMS.ordered).outcomes.some(o => o.k === "deadlock"));
});

test("a specific bad schedule loses the update", () => {
  const m = new Machine(PROGRAMS.race);
  for (const id of [0, 1, 0, 1, 0, 1]) m.step(id);
  assert.equal(m.shared.count, 1);
});

test("blocked threads can't step", () => {
  const m = new Machine(PROGRAMS.locked);
  m.step(0); assert.equal(m.canRun(1), false); assert.equal(m.step(1), false);
});
