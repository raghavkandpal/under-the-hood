import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, ALGOS } from "../lib/sched.js";

const convoy = [{ name: "Big", arrive: 0, burst: 10 }, { name: "a", arrive: 1, burst: 1 }, { name: "b", arrive: 1, burst: 1 }, { name: "c", arrive: 2, burst: 2 }];

test("every algorithm finishes all work with no overlap", () => {
  for (const a of Object.keys(ALGOS)) {
    const r = schedule(convoy, a, 2), busy = r.gantt.filter(g => g.name).reduce((s, g) => s + g.to - g.from, 0);
    assert.equal(busy, 14, a);
    for (let k = 1; k < r.gantt.length; k++) assert.equal(r.gantt[k].from, r.gantt[k - 1].to);
    for (const p of r.per) assert.ok(p.waiting >= 0);
  }
});

test("textbook FCFS example", () => {
  const r = schedule([{ name: "P1", arrive: 0, burst: 24 }, { name: "P2", arrive: 0, burst: 3 }, { name: "P3", arrive: 0, burst: 3 }], "fcfs");
  assert.equal(r.avgWait, 17);
  const s = schedule([{ name: "P1", arrive: 0, burst: 24 }, { name: "P2", arrive: 0, burst: 3 }, { name: "P3", arrive: 0, burst: 3 }], "sjf");
  assert.equal(s.avgWait, 3);
});

test("convoy: FCFS makes short jobs wait; SRTF minimises average wait; RR gives fastest response", () => {
  const f = schedule(convoy, "fcfs"), s = schedule(convoy, "srtf"), r = schedule(convoy, "rr", 1);
  assert.ok(s.avgWait < f.avgWait / 2);
  assert.ok(r.avgResp <= Math.min(f.avgResp, schedule(convoy, "sjf").avgResp));
  assert.ok(r.switches > f.switches);
});

test("idle gaps are handled", () => {
  const r = schedule([{ name: "x", arrive: 0, burst: 2 }, { name: "y", arrive: 5, burst: 1 }], "rr");
  assert.equal(r.end, 6); assert.ok(r.gantt.some(g => g.name === null));
});
