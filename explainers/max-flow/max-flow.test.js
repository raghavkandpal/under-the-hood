import { test } from "node:test";
import assert from "node:assert/strict";
import { maxFlow, NETWORK } from "./max-flow.js";

test("the textbook network carries at most 23 units from source to sink", () => {
  const r = maxFlow(NETWORK, "s", "t");
  assert.equal(r.flow, 23);
  for (const e of NETWORK) assert.ok(r.on[`${e.from}>${e.to}`] <= e.cap, "no pipe over capacity");
});

test("max flow equals the capacity of the smallest cut", () => {
  const r = maxFlow(NETWORK, "s", "t");
  assert.equal(r.cut.capacity, 23); assert.deepEqual(r.cut.edges.map(e => `${e.from}${e.to}`).sort(), ["ac", "dc", "dt"]);
  assert.deepEqual(r.paths.map(p => p.push), [12, 4, 7], "three shortest augmenting paths");
});

test("doubling one bottleneck pipe only helps if it is in the cut", () => {
  const more = (from, to) => maxFlow(NETWORK.map(e => (e.from === from && e.to === to ? { ...e, cap: e.cap * 2 } : e)), "s", "t").flow;
  assert.equal(more("s", "a"), 23, "s→a isn't a bottleneck"); assert.ok(more("a", "c") > 23);
});
