import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPHS, currencyGraph, cycleRate, cycleWeight, bellmanFord, dijkstraOnce } from "./bellman-ford.js";

const NO_CYCLE = { classic: GRAPHS.classic, "chain-front": GRAPHS["chain-front"], "chain-back": GRAPHS["chain-back"],
  "currencies lowered": currencyGraph([2, 0]) };

test("fact 1: Dijkstra settling each node once says A = 2, Bellman–Ford says 1", () => {
  assert.deepEqual(GRAPHS.classic.edges, [[0, 1, 2], [0, 2, 5], [2, 1, -4]]);
  assert.deepEqual(dijkstraOnce(GRAPHS.classic), [0, 2, 5]);
  const r = bellmanFord(GRAPHS.classic);
  assert.deepEqual(r.dist, [0, 1, 5]);
  assert.equal(r.relaxations, 3);
  assert.equal(r.changingRounds, 1);
});

test("fact 2: a 6-node chain takes 5 changing rounds listed back to front, 1 front to back", () => {
  assert.equal(bellmanFord(GRAPHS["chain-back"]).changingRounds, 5);
  assert.equal(bellmanFord(GRAPHS["chain-front"]).changingRounds, 1);
  for (const k of ["chain-back", "chain-front"]) {
    const r = bellmanFord(GRAPHS[k]);
    assert.deepEqual(r.dist, [0, 1, 2, 3, 4, 5]);
    assert.equal(r.relaxations, 5);
    assert.equal(r.bound, 25);
  }
  // the page prints this one: the round after the last change finds nothing
  assert.equal(bellmanFord(GRAPHS["chain-back"]).rounds.length, 6);
  assert.equal(bellmanFord(GRAPHS["chain-front"]).rounds.length, 2);
});

test("fact 3: with no negative cycle, relaxations never exceed (V - 1) x E", () => {
  for (const [name, g] of Object.entries(NO_CYCLE)) {
    const r = bellmanFord(g);
    assert.equal(r.bound, (g.nodes.length - 1) * g.edges.length, name);
    assert.ok(r.relaxations <= r.bound, name);
    assert.equal(r.cycle, null, name);
  }
  assert.equal(bellmanFord(GRAPHS.classic).bound, 6);
});

test("fact 4: a relaxation in round V finds a cycle whose weights sum below 0", () => {
  const g = GRAPHS.loop, r = bellmanFord(g);
  assert.equal(r.rounds.length, g.nodes.length);
  assert.ok(r.rounds[g.nodes.length - 1].changed > 0);
  assert.deepEqual([...r.cycle].sort(), [1, 2, 3]);
  const w = r.cycle.reduce((s, u, i) => s + g.edges.find(e => e[0] === u && e[1] === r.cycle[(i + 1) % r.cycle.length])[2], 0);
  assert.equal(w, -1);
  assert.ok(r.relaxations > r.bound); // 21 against 20: the bound only holds without a negative cycle
  assert.equal(r.relaxations, 21);
  assert.equal(r.bound, 20);
});

test("fact 5: the currency cycle has rate product above 1, and cutting GBP→USD by 1% removes every cycle", () => {
  const g = currencyGraph(), r = bellmanFord(g);
  const names = r.cycle.map(i => g.nodes[i]);
  assert.deepEqual(names, ["USD", "EUR", "GBP"]);
  assert.ok(Math.abs(cycleRate(g, r.cycle) - 1.0098) < 1e-9);
  assert.ok(cycleWeight(g, r.cycle) < 0);
  assert.equal(cycleWeight(g, r.cycle).toFixed(4), "-0.0098"); // the page prints this
  assert.equal(g.edges.length, 12);
  assert.equal(cycleRate(currencyGraph([2, 0]), r.cycle).toFixed(4), "0.9997");
  // every simple cycle in the 4-currency graph, by brute force
  const cycles = [];
  const dfs = (s, path) => {
    for (let v = 0; v < 4; v++) {
      if (v === path.at(-1)) continue;
      if (v === s && path.length > 1) cycles.push([...path]);
      else if (v > s && !path.includes(v)) dfs(s, [...path, v]);
    }
  };
  for (let s = 0; s < 4; s++) dfs(s, [s]);
  assert.equal(cycles.length, 20);
  assert.equal(cycles.filter(c => cycleRate(g, c) > 1).length, 4);
  const h = currencyGraph([2, 0]);
  assert.equal(cycles.filter(c => cycleRate(h, c) > 1).length, 0);
  assert.equal(bellmanFord(h).cycle, null);
  assert.ok(Math.abs(cycleRate(h, r.cycle) - 1.0098 * 0.99) < 1e-9); // 0.99970
  assert.ok(cycleRate(h, r.cycle) < 1);
});
