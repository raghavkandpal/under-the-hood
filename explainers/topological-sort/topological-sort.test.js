import { test } from "node:test";
import assert from "node:assert/strict";
import { kahn, allOrders, valid, TASKS, DEPS } from "./topological-sort.js";

test("Kahn's order puts every task after its dependencies", () => {
  const r = kahn(TASKS, DEPS);
  assert.equal(r.order.length, TASKS.length); assert.ok(valid(r.order, DEPS)); assert.deepEqual(r.cycle, []);
  assert.deepEqual(r.order.slice(0, 3), ["fetch deps", "codegen", "compile lib"]);
});

test("a cycle leaves its members (and everything after them) unsorted", () => {
  const r = kahn(TASKS, [...DEPS, ["deploy", "codegen"]]);
  assert.ok(r.cycle.includes("codegen") && r.cycle.includes("deploy")); assert.ok(!r.order.includes("compile lib"));
  assert.deepEqual(kahn(["a", "b"], [["a", "b"], ["b", "a"]]).order, []);
});

test("how many valid orders: one for a chain, six with no constraints, 48 for this build", () => {
  assert.equal(allOrders(["a", "b", "c"], [["a", "b"], ["b", "c"]]).count, 1);
  assert.equal(allOrders(["a", "b", "c"], []).count, 6);
  const r = allOrders(TASKS, DEPS); assert.equal(r.count, 48); assert.ok(r.examples.every(o => valid(o, DEPS)));
});
