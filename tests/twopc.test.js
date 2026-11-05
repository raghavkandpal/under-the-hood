import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../lib/twopc.js";

test("all yes → everyone commits", () => {
  const r = run();
  assert.deepEqual(r.P.map(p => p.state), ["committed", "committed", "committed"]);
});

test("one no → everyone aborts", () => {
  const r = run({ noVote: 1 });
  assert.deepEqual(r.P.map(p => p.state), ["aborted", "aborted", "aborted"]);
});

test("coordinator crash before deciding leaves yes-voters blocked", () => {
  const r = run({ crash: "coordinator-before-decision" });
  assert.equal(r.blocked, 3); assert.ok(r.consistent);
});

test("crash mid-broadcast: some commit, the rest are stuck, never inconsistent", () => {
  const r = run({ crash: "coordinator-after-decision" });
  assert.equal(r.P[0].state, "committed"); assert.equal(r.blocked, 2); assert.ok(r.consistent);
});

test("a participant that never votes forces an abort", () => {
  const r = run({ crash: "participant-before-vote" });
  assert.equal(r.C.decision, "abort");
});
