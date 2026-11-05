import { test } from "node:test";
import assert from "node:assert/strict";
import { DATASETS, makeDataset } from "./datasets.js";
import { MLP, trainStep } from "./autograd.js";

test("datasets are deterministic, balanced and in range", () => {
  for (const k of Object.keys(DATASETS)) {
    const a = makeDataset(k, { seed: 5 }), b = makeDataset(k, { seed: 5 });
    assert.deepEqual(a, b);
    const pos = a.filter(p => p.y === 1).length;
    assert.ok(pos > 50 && pos < 110, `${k} balance ${pos}`);
    for (const p of a) assert.ok(Math.abs(p.x[0]) < 4 && Math.abs(p.x[1]) < 4, `${k} range`);
  }
});

test("an MLP learns the circle dataset", () => {
  const d = makeDataset("circles", { n: 80, seed: 2 });
  const m = new MLP([2, 8, 1], { seed: 4 });
  let r;
  for (let i = 0; i < 250; i++) r = trainStep(m, d.map(p => p.x), d.map(p => p.y), { lr: 0.3 });
  assert.ok(r.acc > 0.95, `acc ${r.acc}`);
});
