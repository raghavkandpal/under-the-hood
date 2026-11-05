import { test } from "node:test";
import assert from "node:assert/strict";
import { run, PRESETS } from "./eventloop.js";

test("sync, then microtasks, then timers", () => { assert.deepEqual(run(PRESETS.classic.prog).out, ["1", "4", "3", "2"]); });
test("a microtask queued by a microtask still runs before the timer", () => { assert.deepEqual(run(PRESETS.chain.prog).out, ["a", "c", "b", "timeout"]); });
test("busy code delays a timer past its due time", () => {
  const r = run(PRESETS.blocking.prog); assert.deepEqual(r.out, ["done", "tick"]);
  assert.ok(r.steps.find(s => /run task: tick/.test(s.note)).now >= 200);
});
test("timers fire by due time, not registration order", () => { assert.deepEqual(run(PRESETS.order.prog).out, ["sync", "fast", "slow"]); });
test("every step has an empty stack before a task starts", () => {
  const r = run(PRESETS.classic.prog); r.steps.filter(s => /^run (task|microtask)/.test(s.note)).forEach(s => assert.equal(s.stack.length, 1));
});
