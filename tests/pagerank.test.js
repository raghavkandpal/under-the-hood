import { test } from "node:test";
import assert from "node:assert/strict";
import { pagerank, surf } from "../lib/pagerank.js";

const sum = a => a.reduce((x, y) => x + y, 0);

test("ranks sum to 1, a cycle is uniform", () => {
  const r = pagerank(4, [[0, 1], [1, 2], [2, 3], [3, 0]]).rank;
  assert.ok(Math.abs(sum(r) - 1) < 1e-12);
  for (const v of r) assert.ok(Math.abs(v - 0.25) < 1e-9);
});

test("a page everyone links to ranks highest; dangling pages are handled", () => {
  const r = pagerank(5, [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1]]).rank;
  assert.ok(r[0] > Math.max(...r.slice(1)));
  const d = pagerank(3, [[0, 1], [1, 2]]).rank; // node 2 is dangling
  assert.ok(Math.abs(sum(d) - 1) < 1e-12);
});

test("random surfer agrees with power iteration", () => {
  const L = [[0, 1], [0, 2], [1, 2], [2, 0], [3, 2], [4, 3], [4, 0]];
  const r = pagerank(5, L).rank, s = surf(5, L, { steps: 200000, seed: 3 }).share;
  r.forEach((v, i) => assert.ok(Math.abs(v - s[i]) < 0.01, `${i}: ${v} vs ${s[i]}`));
});

test("without damping, a dead-end loop traps everything", () => {
  const L = [[0, 1], [1, 2], [2, 3], [3, 2]]; // 2⇄3 is a trap
  const r = pagerank(4, L, { damping: 0.999, iters: 5000 }).rank;
  assert.ok(r[2] + r[3] > 0.99);
});
