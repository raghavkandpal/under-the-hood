import { test } from "node:test";
import assert from "node:assert/strict";
import { topo, dirty, schedule } from "../lib/toposort.js";

const deps = { "app": ["main.o", "util.o"], "main.o": ["main.c", "util.h"], "util.o": ["util.c", "util.h"], "tests": ["util.o", "test.c"] };
const cost = { "main.c": 0, "util.c": 0, "util.h": 0, "test.c": 0, "main.o": 4, "util.o": 3, "app": 2, "tests": 5 };

test("every target comes after all of its dependencies", () => {
  const { order } = topo(deps), pos = Object.fromEntries(order.map((n, i) => [n, i]));
  for (const [t, ds] of Object.entries(deps)) for (const d of ds) assert.ok(pos[d] < pos[t], `${d} before ${t}`);
});

test("cycles are detected and reported", () => {
  const r = topo({ a: ["b"], b: ["c"], c: ["a"] });
  assert.ok(r.cycle); assert.equal(r.cycle[0], r.cycle.at(-1));
});

test("editing a header rebuilds its users, not the unrelated parts", () => {
  assert.deepEqual([...dirty(deps, ["util.h"])].sort(), ["app", "main.o", "tests", "util.h", "util.o"]);
  assert.deepEqual([...dirty(deps, ["test.c"])].sort(), ["test.c", "tests"]);
});

test("critical path and parallel speed-up", () => {
  const s = schedule(deps, cost);
  assert.equal(s.total, 8); assert.equal(s.serial, 14); // util.o(3) → tests(5)
  assert.deepEqual(s.path.slice(-2), ["util.o", "tests"]);
});
