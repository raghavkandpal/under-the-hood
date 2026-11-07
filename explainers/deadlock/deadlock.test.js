import { test } from "node:test";
import assert from "node:assert/strict";
import { run, start, apply, actions, waitsFor } from "./deadlock.js";
import { mulberry } from "../../shared/random.js";

test("everyone holding their left fork is a deadlock, and the wait-for graph is a cycle", () => {
  let s = start(5); for (let i = 0; i < 5; i++) s = apply(s, { who: i, kind: "take", fork: i });
  assert.deepEqual(actions(s, "naive"), []); assert.deepEqual(waitsFor(s, "naive"), [1, 2, 3, 4, 0]);
});

test("the naive order deadlocks sooner or later", () => {
  const rnd = mulberry(1); let stuck = 0;
  for (let k = 0; k < 200; k++) if (run({ strategy: "naive", steps: 2000, rnd }).deadlockAt !== null) stuck++;
  assert.ok(stuck > 190, `${stuck} of 200`);
});

test("a global fork order and a waiter both prevent it, and everyone still eats", () => {
  const rnd = mulberry(2);
  for (const strategy of ["ordered", "waiter"]) for (let k = 0; k < 100; k++) {
    const r = run({ strategy, steps: 2000, rnd }); assert.equal(r.deadlockAt, null, strategy);
    assert.ok(r.states.at(-1).meals.every(m => m > 0), `${strategy}: ${r.states.at(-1).meals}`);
  }
});

test("forks are never shared", () => {
  const r = run({ strategy: "waiter", steps: 500, rnd: mulberry(3) });
  for (const s of r.states) assert.equal(s.held.flat().length, new Set(s.held.flat()).size);
});
