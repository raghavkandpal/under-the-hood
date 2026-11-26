import test from "node:test";
import assert from "node:assert/strict";
import { layout, NW, NH } from "./graph.js";
import { CATALOG, AREAS } from "../catalog.js";

const areas = [{ id: "a" }, { id: "b" }];
const toy = [
  { id: "x", title: "X", area: "a", prereqs: [] },
  { id: "y", title: "Y", area: "b", prereqs: ["x"] },
  { id: "z", title: "Z", area: "a", prereqs: ["x", "y"] },
  { id: "w", title: "W", area: "a", prereqs: [] },
];
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

test("every node gets a finite position inside the box, and the box starts at the origin", () => {
  const { nodes, edges, width, height } = layout(toy, areas);
  assert.equal(nodes.length, 4);
  assert.equal(edges.length, 3);
  for (const n of nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && n.x - NW / 2 >= 0 && n.y - NH / 2 >= 0 && n.x + NW / 2 <= width && n.y + NH / 2 <= height, n.id);
});

test("the same catalog always gives the same picture", () => {
  assert.deepEqual(layout(toy, areas), layout(toy, areas));
});

test("an unknown prerequisite is ignored and a cycle cannot hang the layout", () => {
  const { nodes, edges } = layout([{ id: "p", title: "P", area: "a", prereqs: ["nope", "q"] }, { id: "q", title: "Q", area: "a", prereqs: ["p"] }], areas);
  assert.equal(nodes.length, 2);
  assert.equal(edges.length, 2);
});

test("the real catalog: every explainer is placed once, and linked explainers sit closer than the average pair", () => {
  const { nodes, edges } = layout(CATALOG, AREAS);
  assert.equal(nodes.length, CATALOG.length);
  assert.equal(new Set(nodes.map(n => `${Math.round(n.x)},${Math.round(n.y)}`)).size, CATALOG.length, "no two nodes on the same spot");
  assert.equal(edges.length, CATALOG.reduce((s, c) => s + c.prereqs.length, 0));
  const at = new Map(nodes.map(n => [n.id, n]));
  const linked = edges.reduce((s, e) => s + dist(at.get(e.from), at.get(e.to)), 0) / edges.length;
  let all = 0, pairs = 0;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { all += dist(nodes[i], nodes[j]); pairs++; }
  assert.ok(linked < (all / pairs) / 2, `linked ${linked.toFixed(0)} vs all ${(all / pairs).toFixed(0)}`);
});

test("explainers of one area end up nearer each other than to the rest", () => {
  const { nodes } = layout(CATALOG, AREAS);
  const mean = (a, b) => { let s = 0, n = 0; for (const p of a) for (const q of b) if (p !== q) { s += dist(p, q); n++; } return s / n; };
  const sec = nodes.filter(n => n.area === "security"), rest = nodes.filter(n => n.area !== "security");
  assert.ok(mean(sec, sec) < mean(sec, rest));
});

test("no two boxes overlap", () => {
  const { nodes } = layout(CATALOG, AREAS);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++)
    assert.ok(Math.abs(nodes[i].x - nodes[j].x) >= NW || Math.abs(nodes[i].y - nodes[j].y) >= NH, `${nodes[i].id} overlaps ${nodes[j].id}`);
});
