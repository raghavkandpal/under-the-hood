import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, recoveryTime, goodput, POLICIES } from "../lib/resilience.js";

const sum = a => a.reduce((x, y) => x + y, 0);
const run = (policy, len) => { const r = simulate({ policy, outage: [40, 40 + len] }); return { r, rec: recoveryTime(r, 40 + len, 70), failed: sum(r.failed) }; };

test("overload collapses goodput", () => { assert.equal(goodput(80, 100), 80); assert.equal(goodput(150, 100), 50); assert.equal(goodput(250, 100), 0); });

test("immediate retries turn even a short blip into a permanent outage", () => {
  assert.equal(run("naive", 3).rec, Infinity); assert.equal(run("none", 3).rec, 0);
});

test("backoff with jitter rides out a short blip with almost no failures", () => {
  const b = run("backoff", 3), n = run("none", 3); assert.ok(b.rec < 20); assert.ok(b.failed < n.failed / 5);
});

test("after a long outage only a retry budget or a circuit breaker recovers", () => {
  assert.equal(run("backoff", 20).rec, Infinity);
  assert.ok(run("budget", 20).rec < 10); assert.ok(run("breaker", 20).rec < 15);
});

test("the breaker sheds load while open", () => {
  const { r } = run("breaker", 20); assert.ok(r.state.includes("open")); assert.ok(sum(r.shed) > 0);
  assert.ok(Object.keys(POLICIES).length === 5);
});
