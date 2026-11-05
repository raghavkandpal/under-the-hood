import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, PIPELINES } from "../lib/pipes.js";

const P = PIPELINES;

test("a pipeline runs at the speed of its slowest stage", () => {
  const r = simulate(P.slow.stages, { input: 8000, buffer: 64 });
  assert.ok(r.finished); assert.ok(Math.abs(r.ticks - 8000 / 8) < 30, `ticks ${r.ticks}`);
});

test("pipe buffers never overflow, so memory stays small however big the file", () => {
  for (const input of [5000, 50000]) {
    const r = simulate(P.slow.stages, { input, buffer: 64 });
    for (const h of r.hist) for (const p of h.pipes) assert.ok(p <= 64);
    assert.ok(r.peakMemory <= 64 * 2, `peak ${r.peakMemory}`);
  }
});

test("head stops the whole pipeline early (SIGPIPE)", () => {
  const r = simulate(P.head.stages, { input: 100000 });
  assert.equal(r.output, 10); assert.ok(r.finished);
  assert.ok(r.read < 2000, `read only ${r.read} of 100000 lines`);
  assert.ok(r.stages[0].sigpipe && r.stages[1].sigpipe && r.stages[2].exited);
});

test("wc -l must read everything but still uses little memory", () => {
  const r = simulate(P.count.stages, { input: 20000 });
  assert.equal(r.read, 20000); assert.equal(r.output, 1); assert.equal(r.stages[2].counted, 1000); assert.ok(r.peakMemory <= 130);
});

test("sort holds the whole input in memory before writing anything", () => {
  const r = simulate(P.sort.stages, { input: 10000 }); assert.ok(r.finished);
  assert.ok(r.peakMemory >= 10000 * 0.95, `peak ${r.peakMemory}`);
  const firstOut = r.hist.findIndex(h => h.out > 0), allRead = r.hist.findIndex(h => h.read === 10000);
  assert.ok(firstOut > allRead, "nothing comes out of sort until the input has all gone in");
});
