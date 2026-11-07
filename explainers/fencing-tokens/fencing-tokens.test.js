import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./fencing-tokens.js";

test("a short pause is harmless: A writes inside its lease, then B", () => {
  const r = simulate({ pauseLen: 3, fencing: false });
  assert.ok(r.safe); assert.ok(!r.stale); assert.equal(r.storage.value, "B's update");
});

test("a long pause without fencing: A's stale write lands after B's and wins", () => {
  const r = simulate({ pauseLen: 15, fencing: false });
  assert.ok(r.stale); assert.ok(!r.safe); assert.equal(r.storage.value, "A's update");
  assert.deepEqual(r.storage.writes.map(w => [w.who, w.ok]), [["B", true], ["A", true]]);
});

test("with fencing, storage rejects the older token", () => {
  const r = simulate({ pauseLen: 15, fencing: true });
  assert.ok(r.safe); assert.equal(r.storage.value, "B's update");
  assert.deepEqual(r.storage.writes.map(w => [w.who, w.token, w.ok]), [["B", 34, true], ["A", 33, false]]);
});

test("events come out in time order", () => {
  const e = simulate({ pauseLen: 15, fencing: true }).events; assert.ok(e.every((x, i) => !i || e[i - 1].t <= x.t));
});
