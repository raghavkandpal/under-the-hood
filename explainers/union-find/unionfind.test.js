import { test } from "node:test";
import assert from "node:assert/strict";
import { DSU, gridGraph, kruskal } from "./unionfind.js";
import { mulberry } from "../../shared/random.js";

test("connectivity matches a brute-force graph search", () => {
  const n = 60, r = mulberry(4), d = new DSU(n), adj = Array.from({ length: n }, () => []);
  for (let k = 0; k < 45; k++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); d.union(a, b); adj[a].push(b); adj[b].push(a); }
  const comp = new Array(n).fill(-1); let c = 0;
  for (let s = 0; s < n; s++) if (comp[s] < 0) { const st = [s]; comp[s] = c; while (st.length) { const u = st.pop(); for (const v of adj[u]) if (comp[v] < 0) { comp[v] = c; st.push(v); } } c++; }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) assert.equal(d.find(a) === d.find(b), comp[a] === comp[b]);
  assert.equal(d.sets, c);
});

test("naive unions in a chain build a tall tree; rank + compression keep it flat", () => {
  const n = 512, naive = new DSU(n, { rank: false, compress: false }), smart = new DSU(n);
  for (let i = 1; i < n; i++) { naive.union(i, i - 1); smart.union(i, i - 1); }
  assert.ok(naive.maxDepth() > 100); assert.ok(smart.maxDepth() <= 2);
  for (let q = 0; q < 2000; q++) { naive.find(0); smart.find(0); }
  assert.ok(smart.work * 20 < naive.work);
});

test("Kruskal builds a spanning tree with n-1 edges", () => {
  const w = 6, h = 5, { steps } = kruskal(w * h, gridGraph(w, h, 2));
  assert.equal(steps.filter(s => s.taken).length, w * h - 1);
});
