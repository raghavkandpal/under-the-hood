import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, gridQuery, scan, makePoints } from "./quadtree.js";
import { mulberry } from "../../shared/random.js";

const key = ps => ps.map(p => `${p.x},${p.y}`).sort();

test("tree and grid queries return exactly what a full scan does", () => {
  const rnd = mulberry(1);
  for (const kind of ["uniform", "clustered"]) {
    const pts = makePoints(3000, kind, rnd), t = buildTree(pts);
    for (let i = 0; i < 30; i++) {
      const r = { x: rnd() * 0.8, y: rnd() * 0.8, w: rnd() * 0.3, h: rnd() * 0.3 };
      assert.deepEqual(key(t.query(r).points), key(scan(pts, r).points)); assert.deepEqual(key(gridQuery(pts, r).points), key(scan(pts, r).points));
    }
  }
});

test("a small query on 20,000 points checks only a tiny fraction of them", () => {
  const pts = makePoints(20000, "uniform", mulberry(2)), q = buildTree(pts).query({ x: 0.4, y: 0.4, w: 0.05, h: 0.05 });
  assert.ok(q.checked < 200, `checked ${q.checked}`); assert.ok(q.points.length > 20);
});

test("the tree splits deeper where points are dense", () => {
  const t = buildTree(makePoints(4000, "clustered", mulberry(3))), leaves = t.nodes().filter(n => n.leaf);
  const depths = leaves.map(l => l.depth); assert.ok(Math.max(...depths) - Math.min(...depths) >= 4);
});

test("on clustered data a fixed grid checks far more than the tree", () => {
  const pts = makePoints(20000, "clustered", mulberry(4)), t = buildTree(pts);
  let tree = 0, grid = 0; const rnd = mulberry(5);
  for (let i = 0; i < 40; i++) { const p = pts[Math.floor(rnd() * pts.length)], r = { x: p.x - 0.01, y: p.y - 0.01, w: 0.02, h: 0.02 }; tree += t.query(r).checked; grid += gridQuery(pts, r, 8).checked; }
  assert.ok(grid > tree * 5, `grid ${grid} vs tree ${tree}`);
});
