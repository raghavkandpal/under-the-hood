import { test } from "node:test";
import assert from "node:assert/strict";
import { makePoints, run, init, SHAPES } from "../lib/kmeans.js";

test("inertia never increases during Lloyd iterations", () => {
  for (const s of Object.keys(SHAPES)) for (const m of ["random", "plusplus"]) {
    const { hist } = run(makePoints(s, 2), 4, m, 3);
    for (let i = 1; i < hist.length; i++) assert.ok(hist[i] <= hist[i - 1] + 1e-9, `${s}/${m} rose at ${i}`);
  }
});

test("k-means++ finds the 5 blobs more reliably than random init", () => {
  const pts = makePoints("blobs5", 1);
  // the right 5-cluster answer has inertia ≈ 35; local optima are 95+
  const score = m => { let wins = 0; for (let s = 1; s <= 30; s++) { const r = run(pts, 5, m, s); if (r.hist.at(-1) < 40) wins++; } return wins; };
  const pp = score("plusplus"), rnd = score("random");
  assert.ok(pp >= rnd, `++ ${pp} vs random ${rnd}`);
  assert.ok(pp >= 24, `++ ${pp}`);
});

test("init returns k distinct centres", () => {
  const pts = makePoints("blobs3", 1);
  for (const m of ["random", "plusplus"]) assert.equal(new Set(init(pts, 6, m, 4).map(c => c.join())).size, 6);
});
