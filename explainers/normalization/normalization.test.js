import { test } from "node:test";
import assert from "node:assert/strict";
import { WIDE, normalise, join, initial, view, customers, ACTIONS, conflicts, cells } from "./normalization.js";

test("normalising then joining gives back the same rows", () => {
  const db = normalise(WIDE);
  assert.deepEqual(join(db), WIDE);
  assert.deepEqual([db.customers.length, db.products.length, db.orders.length], [3, 3, 6]);
});

test("update anomaly: editing one order's email splits Ada in two, but not when normalised", () => {
  const wide = ACTIONS.editEmail(initial("wide")).db, norm = ACTIONS.editEmail(initial("norm")).db;
  assert.deepEqual(conflicts(wide), ["Ada"]); assert.deepEqual(conflicts(norm), []);
  assert.ok(view(norm).filter(r => r.customer === "Ada").every(r => r.email === "ada@newmail.com"));
});

test("deletion anomaly: deleting Dara's only order forgets Dara, unless normalised", () => {
  assert.ok(!customers(ACTIONS.deleteOrder(initial("wide")).db).includes("Dara"));
  assert.ok(customers(ACTIONS.deleteOrder(initial("norm")).db).includes("Dara"));
});

test("insertion anomaly: a customer with no orders can't be stored in the wide table", () => {
  assert.ok(ACTIONS.addCustomer(initial("wide")).error);
  const r = ACTIONS.addCustomer(initial("norm")); assert.ok(!r.error && customers(r.db).includes("Grace"));
});

test("actions don't mutate their input, and normalised storage is smaller", () => {
  const db = initial("wide"); ACTIONS.deleteOrder(db); assert.equal(db.wide.length, 6);
  assert.equal(cells(initial("wide")), 42); assert.equal(cells(initial("norm")), 12 + 9 + 24);
});
