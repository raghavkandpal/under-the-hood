import { test } from "node:test";
import assert from "node:assert/strict";
import { merge3 } from "./three-way-merge.js";

const base = ["a", "b", "c", "d", "e"];

test("edits to different lines merge cleanly", () => {
  const r = merge3(base, ["A", "b", "c", "d", "e"], ["a", "b", "c", "d", "E"]);
  assert.deepEqual(r.conflicts, 0); assert.deepEqual(r.lines, ["A", "b", "c", "d", "E"]);
});

test("different edits to the same line conflict, with both versions kept", () => {
  const r = merge3(base, ["a", "B1", "c", "d", "e"], ["a", "B2", "c", "d", "e"]);
  assert.equal(r.conflicts, 1);
  assert.deepEqual(r.lines, ["a", "<<<<<<< ours", "B1", "=======", "B2", ">>>>>>> theirs", "c", "d", "e"]);
});

test("the same edit on both sides is taken once", () => {
  const r = merge3(base, ["a", "B", "c", "d", "e"], ["a", "B", "c", "d", "e"]);
  assert.equal(r.conflicts, 0); assert.deepEqual(r.lines, ["a", "B", "c", "d", "e"]);
});

test("the ancestor is what tells a deletion from an addition", () => {
  const r = merge3(base, ["a", "b", "d", "e"], ["a", "b", "c", "d", "e", "f"]);
  assert.equal(r.conflicts, 0); assert.deepEqual(r.lines, ["a", "b", "d", "e", "f"], "c was deleted by ours, f added by theirs");
});

test("both sides inserting different lines at the same spot conflict", () => {
  const r = merge3(["x", "y"], ["x", "1", "y"], ["x", "2", "y"]);
  assert.equal(r.conflicts, 1); assert.deepEqual(r.regions.map(g => g.kind), ["same", "conflict", "same"]);
});
