import { test } from "node:test";
import assert from "node:assert/strict";
import { init, step, converge, dijkstra, INF } from "./routing.js";

const links = [["A", "B", 1], ["B", "C", 2], ["A", "D", 4], ["C", "D", 1], ["C", "E", 3], ["D", "E", 1]];
const nodes = ["A", "B", "C", "D", "E"];

test("distance vector converges to the true shortest paths", () => {
  const { tables, rounds } = converge(init(nodes), links);
  for (const n of nodes) { const d = dijkstra(links, n); for (const m of nodes) assert.equal(tables[n][m].cost, d[m], `${n}→${m}`); }
  assert.ok(rounds <= nodes.length);
});

test("news travels one hop per round", () => {
  const t1 = step(init(nodes), links).tables;
  assert.equal(t1.A.B.cost, 1); assert.equal(t1.A.E, undefined);
});

test("count to infinity without split horizon, fast with it", () => {
  const line = [["A", "B", 1], ["B", "C", 1]], ok = converge(init(["A", "B", "C"]), line).tables;
  const broken = [["A", "B", 1]];
  const slow = converge(ok, broken), fast = converge(ok, broken, { splitHorizon: true });
  assert.equal(slow.tables.A.C.cost, INF); assert.equal(fast.tables.A.C.cost, INF);
  assert.ok(slow.rounds >= 10, `slow took ${slow.rounds}`); assert.ok(fast.rounds <= 3, `fast took ${fast.rounds}`);
});
