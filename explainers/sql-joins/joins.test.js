import { test } from "node:test";
import assert from "node:assert/strict";
import { join, nestedLoop, hashJoin, mergeJoin } from "./joins.js";

const users = [{ id: 1, name: "ana" }, { id: 2, name: "bo" }, { id: 3, name: "cy" }];
const orders = [{ id: 1, item: "pen" }, { id: 1, item: "ink" }, { id: 3, item: "cup" }, { id: 9, item: "orphan" }];

test("join kinds return the right row counts", () => {
  assert.equal(join(users, orders, "id", "inner").length, 3);
  assert.equal(join(users, orders, "id", "left").length, 4);   // + bo with no orders
  assert.equal(join(users, orders, "id", "right").length, 4);  // + orphan order
  assert.equal(join(users, orders, "id", "full").length, 5);
  assert.equal(join(users, orders, "id", "cross").length, 12);
});

test("null keys never match", () => {
  assert.equal(join([{ id: null }], [{ id: null }], "id", "inner").length, 0);
});

test("all three algorithms agree with the inner join", () => {
  const key = p => `${p.l.name}-${p.r.item}`, want = join(users, orders, "id").map(key).sort();
  for (const f of [nestedLoop, hashJoin, mergeJoin]) assert.deepEqual(f(users, orders, "id").out.map(key).sort(), want);
});

test("hash join is linear, nested loop quadratic", () => {
  const A = Array.from({ length: 1000 }, (_, i) => ({ id: i })), B = Array.from({ length: 1000 }, (_, i) => ({ id: i * 2 }));
  assert.equal(nestedLoop(A, B, "id").ops, 1e6);
  assert.equal(hashJoin(A, B, "id").ops, 2000);
  assert.equal(hashJoin(A, B, "id").out.length, 500);
  assert.ok(mergeJoin(A, B, "id", { sorted: true }).ops <= 2000);
});
