import { test } from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../lib/isolation.js";

// The textbook matrix (as implemented by PostgreSQL-style MVCC): which anomalies each level allows.
const EXPECTED = {
  dirty: { ru: true, rc: false, si: false, ser: false },
  nonrepeat: { ru: true, rc: true, si: false, ser: false },
  lost: { ru: true, rc: true, si: false, ser: false },
  skew: { ru: true, rc: true, si: true, ser: false },
};

test("anomaly matrix matches the textbook", () => {
  for (const [s, row] of Object.entries(EXPECTED)) for (const [lvl, want] of Object.entries(row)) {
    assert.equal(runScenario(s, lvl).anomaly, want, `${s} @ ${lvl}`);
  }
});

test("prevention works by aborting, and the surviving state is consistent", () => {
  const lost = runScenario("lost", "si");
  assert.deepEqual(lost.aborted, ["T2"]); assert.equal(lost.final.balance, 150);
  const skew = runScenario("skew", "ser");
  assert.equal(skew.aborted.length, 1); assert.ok(skew.final.alice_on_call || skew.final.bob_on_call);
});
