import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, jain } from "./congestion-control.js";

test("slow start doubles the window every round trip until the first loss", () => {
  const r = simulate({ flows: [{ start: 0, w: 1 }], capacity: 100, rtts: 10 });
  assert.deepEqual(r.series[0].slice(0, 10), [1, 2, 4, 8, 16, 32, 64, 128, 64, 65], "128 > 100 is lost, halved, then grows by one");
  assert.deepEqual(r.losses, [7]);
});

test("one AIMD flow saws between half and full capacity: about 75% utilisation", () => {
  const r = simulate({ flows: [{ start: 0, w: 1 }], capacity: 60, rtts: 600 });
  assert.ok(r.utilisation > 0.72 && r.utilisation < 0.8, `${r.utilisation}`);
  assert.ok(simulate({ flows: [{ start: 0, w: 1 }], capacity: 60, buffer: 60, rtts: 600 }).utilisation > 0.97, "a buffer as big as the link fills the troughs");
});

test("AIMD converges to a fair share; AIAD and MIMD keep the latecomer behind", () => {
  const flows = [{ start: 0, w: 1 }, { start: 40, w: 1 }];
  assert.ok(simulate({ rule: "aimd", flows, rtts: 400 }).fairness > 0.99);
  const aiad = simulate({ rule: "aiad", flows, rtts: 400 }), mimd = simulate({ rule: "mimd", flows, rtts: 400 });
  assert.ok(aiad.fairness < 0.9, `aiad ${aiad.fairness}`); assert.ok(mimd.fairness < 0.95, `mimd ${mimd.fairness}`);
  assert.ok(aiad.avgs[0] > aiad.avgs[1] * 2, "the first flow keeps its head start");
});

test("Jain's index", () => { assert.equal(jain([5, 5]), 1); assert.equal(jain([10, 0]), 0.5); });
