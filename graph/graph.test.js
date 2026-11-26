import test from "node:test";
import assert from "node:assert/strict";
import { layout, COLW, ROWH } from "./graph.js";
import { CATALOG, AREAS } from "../catalog.js";

const areas = [{ id: "a" }, { id: "b" }];
const toy = [
  { id: "x", title: "X", area: "a", prereqs: [] },
  { id: "y", title: "Y", area: "b", prereqs: ["x"] },
  { id: "z", title: "Z", area: "a", prereqs: ["x", "y"] },
  { id: "w", title: "W", area: "a", prereqs: [] },
];

test("one column per prerequisite depth, areas grouped inside a column", () => {
  const { nodes, edges, width, height } = layout(toy, areas);
  const at = Object.fromEntries(nodes.map(n => [n.id, [n.x / COLW, n.y / ROWH]]));
  assert.deepEqual(at, { w: [0, 0], x: [0, 1], y: [1, 0], z: [2, 0] });
  assert.equal(edges.length, 3);
  assert.equal(width, 3 * COLW);
  assert.equal(height, 2 * ROWH);
});

test("an unknown prerequisite is ignored and a cycle cannot hang the layout", () => {
  const { nodes, edges } = layout([{ id: "p", title: "P", area: "a", prereqs: ["nope", "q"] }, { id: "q", title: "Q", area: "a", prereqs: ["p"] }], areas);
  assert.equal(nodes.length, 2);
  assert.equal(edges.length, 2);
});

test("the real catalog: every explainer is placed once, and every arrow points right", () => {
  const { nodes, edges } = layout(CATALOG, AREAS);
  assert.equal(nodes.length, CATALOG.length);
  assert.equal(new Set(nodes.map(n => `${n.x},${n.y}`)).size, CATALOG.length);
  assert.equal(edges.length, CATALOG.reduce((s, c) => s + c.prereqs.length, 0));
  const at = new Map(nodes.map(n => [n.id, n]));
  for (const { from, to } of edges) assert.ok(at.get(from).x < at.get(to).x, `${from} -> ${to}`);
});
