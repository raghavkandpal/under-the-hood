import { test } from "node:test";
import assert from "node:assert/strict";
import { kahn } from "../topological-sort/topological-sort.js";
import {
  GRAPH, kosaraju, reachability, bruteForceGroups, sortGroups, isStronglyConnected, condensation,
  WORKED, WORKED_PLUS, twoSat, bruteForceSat, clausesHold, randomFormula, clauseText, componentsView, satView,
} from "./strongly-connected.js";

const truth = sortGroups(bruteForceGroups(GRAPH));

test("the built-in graph: 8 nodes, 11 edges, 4 components", () => {
  assert.equal(GRAPH.n, 8);
  assert.equal(GRAPH.edges.length, 11);
  assert.deepEqual(truth, [[0, 1, 2], [3, 4], [5], [6, 7]]);
});

test("fact 1: components match mutual reachability", () => {
  const r = reachability(GRAPH), k = kosaraju(GRAPH);
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) assert.equal(k.comp[a] === k.comp[b], r[a][b] && r[b][a], `${a},${b}`);
  assert.deepEqual(sortGroups(k.groups), truth);
});

test("fact 2: the condensation is acyclic", () => {
  const c = condensation(GRAPH, kosaraju(GRAPH).comp), r = kahn([...Array(c.n).keys()], c.edges);
  assert.equal(c.n, 4);
  assert.equal(c.edges.length, 4);
  assert.equal(r.order.length, 4);
  assert.deepEqual(r.cycle, []);
});

test("fact 3: reverse postorder works, plain node order merges components", () => {
  const good = kosaraju(GRAPH), bad = kosaraju(GRAPH, "node");
  assert.deepEqual(good.order, [6, 7, 5, 3, 4, 0, 2, 1]);
  assert.deepEqual(good.groups, [[6, 7], [5], [3, 4], [0, 1, 2]]);
  assert.ok(good.groups.every(g => isStronglyConnected(GRAPH, g)));
  assert.deepEqual(bad.groups, [[0, 1, 2, 3, 4, 5, 6, 7]]);
  assert.ok(!isStronglyConnected(GRAPH, bad.groups[0]));
  assert.notDeepEqual(sortGroups(bad.groups), truth);
});

test("fact 3: DFS from node 0 reaches into another component", () => {
  const r = reachability(GRAPH);
  assert.ok(r[0][6] && r[0][7] && !r[6][0] && !r[7][0]);
});

test("fact 4: both passes look at every edge once, 2E checks", () => {
  assert.equal(kosaraju(GRAPH).checks, 22);
  assert.equal(kosaraju(GRAPH, "node").checks, 22);
  assert.equal(kosaraju(GRAPH).checks, 2 * GRAPH.edges.length);
  const ring = { n: 4, edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]] };
  assert.equal(kosaraju(ring).checks, 10);
  assert.equal(kosaraju({ n: 3, edges: [] }).checks, 0);
});

test("fact 5: the worked formula has 8 edges over 6 literals and is satisfiable", () => {
  assert.equal(WORKED.map(clauseText).join(" ∧ "), "(a ∨ ¬b) ∧ (¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c)");
  const r = twoSat(3, WORKED);
  assert.equal(r.edges, 8);
  assert.equal(r.literals, 6);
  assert.equal(r.satisfiable, true);
  assert.deepEqual(r.assignment, [false, false, false]);
  assert.ok(clausesHold(r.assignment, WORKED));
  assert.equal(WORKED.length, 4);
  assert.equal(r.groups.length, 4);
});

test("fact 6: adding (a ∨ b) puts a and ¬a in one component", () => {
  const r = twoSat(3, WORKED_PLUS);
  assert.equal(r.edges, 10);
  assert.equal(r.satisfiable, false);
  assert.equal(r.assignment, null);
  assert.equal(r.comp[0], r.comp[1]);
  assert.deepEqual(r.clash, [0, 1]);
  // a => ¬b => ¬a => b => a, the chain the page spells out
  const has = (x, y) => r.graph.edges.some(([p, q]) => p === x && q === y);
  assert.ok(has(0, 3) && has(3, 1) && has(1, 2) && has(2, 0));
  assert.equal(bruteForceSat(3, WORKED_PLUS), false);
});

test("fact 6: 200 seeded formulas over 5 variables agree with all 32 assignments", () => {
  let sat = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const f = randomFormula(seed), r = twoSat(5, f);
    assert.equal(r.satisfiable, bruteForceSat(5, f), `seed ${seed}`);
    if (r.satisfiable) { sat++; assert.ok(clausesHold(r.assignment, f), `seed ${seed}`); }
  }
  assert.equal(sat, 165);
  const sizes = Array.from({ length: 200 }, (_, i) => randomFormula(i + 1).length);
  assert.deepEqual([Math.min(...sizes), Math.max(...sizes)], [4, 12]);
  assert.equal(1 << 5, 32);
});

test("the displayed views redraw from their inputs in every mode", () => {
  const a = componentsView("reverse-postorder"), b = componentsView("node");
  assert.deepEqual([a.groups.length, a.bad, a.correct, a.checks], [4, 0, true, 22]);
  assert.deepEqual([b.groups.length, b.bad, b.correct, b.checks], [1, 1, false, 22]);
  assert.equal(a.truthCount, 4);
  const w = satView("worked"), p = satView("plus"), r1 = satView("random", 1), r2 = satView("random", 2);
  assert.deepEqual([w.nVars, w.clauses.length, w.edges, w.literals, w.satisfiable, w.holds], [3, 4, 8, 6, true, true]);
  assert.deepEqual([p.nVars, p.clauses.length, p.edges, p.literals, p.satisfiable, p.holds], [3, 5, 10, 6, false, null]);
  assert.equal(r1.nVars, 5);
  assert.equal(r1.literals, 10);
  assert.equal(r1.edges, 2 * r1.clauses.length);
  assert.notDeepEqual(r1.clauses, r2.clauses);
  for (const v of [w, p, r1, r2]) assert.equal(v.satisfiable, v.brute);
});
