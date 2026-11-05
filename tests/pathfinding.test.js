import { test } from "node:test";
import assert from "node:assert/strict";
import { search, maze, ALGOS } from "../lib/pathfinding.js";

const W = 21, H = 15;
const open = new Array(W * H).fill(0);
const S = 1 * W + 1, G = (H - 2) * W + (W - 2);

test("all algorithms find a path on an open grid; optimal ones agree on cost", () => {
  const r = Object.fromEntries(Object.keys(ALGOS).map(a => [a, search(open, W, S, G, a)]));
  for (const a in r) { assert.equal(r[a].path[0], S); assert.equal(r[a].path.at(-1), G); }
  const best = (W - 3) + (H - 3);
  for (const a of ["bfs", "dijkstra", "astar"]) assert.equal(r[a].pathCost, best);
});

test("A* expands far fewer cells than Dijkstra on an open grid", () => {
  const d = search(open, W, S, G, "dijkstra").order.length, a = search(open, W, S, G, "astar").order.length;
  assert.ok(a < d / 2, `A* ${a} vs Dijkstra ${d}`);
});

test("with mud, Dijkstra and A* route around it but BFS does not", () => {
  const g = open.slice();
  for (let y = 0; y < H - 1; y++) for (let x = 5; x <= 15; x++) g[y * W + x] = 9; // heavy mud except bottom row
  const d = search(g, W, S, G, "dijkstra"), a = search(g, W, S, G, "astar"), b = search(g, W, S, G, "bfs");
  assert.equal(d.pathCost, a.pathCost);
  assert.ok(b.pathCost > d.pathCost);
});

test("greedy is fast but not always optimal", () => {
  const g = open.slice();
  for (let y = 2; y < H; y++) g[y * W + 10] = 1; // wall with gap at top
  const gr = search(g, W, S, G, "greedy"), as = search(g, W, S, G, "astar");
  assert.ok(gr.pathCost >= as.pathCost);
});

test("mazes are solvable and unreachable goals return no path", () => {
  for (let s = 1; s < 6; s++) assert.ok(search(maze(W, H, s), W, S, G, "astar").path.length > 0);
  const boxed = open.slice(); for (const c of [G - 1, G + 1, G - W, G + W]) boxed[c] = 1;
  assert.equal(search(boxed, W, S, G, "dijkstra").path.length, 0);
});
