import { test } from "node:test";
import assert from "node:assert/strict";
import { makeScores, confusion, curves } from "../lib/roc.js";

test("AUC: coin-flip ≈ 0.5, well separated ≈ 1", () => {
  assert.ok(Math.abs(curves(makeScores({ sep: 0, n: 4000 })).auc - 0.5) < 0.04);
  assert.ok(curves(makeScores({ sep: 5, n: 2000 })).auc > 0.99);
});

test("AUC equals the chance a random positive outscores a random negative", () => {
  const d = makeScores({ sep: 1, n: 600, seed: 4 }), P = d.filter(x => x.y), N = d.filter(x => !x.y);
  let win = 0; for (const p of P) for (const q of N) win += p.s > q.s ? 1 : p.s === q.s ? 0.5 : 0;
  assert.ok(Math.abs(curves(d).auc - win / (P.length * N.length)) < 1e-9);
});

test("confusion matrix at extreme thresholds", () => {
  const d = makeScores({ n: 200 });
  const all = confusion(d, -Infinity), none = confusion(d, Infinity);
  assert.equal(all.recall, 1); assert.equal(all.fn, 0);
  assert.equal(none.tp + none.fp, 0); assert.equal(none.recall, 0);
  const c = confusion(d, 0.7); assert.equal(c.tp + c.fp + c.tn + c.fn, 200);
});

test("rare positives: same ROC, much lower precision", () => {
  const common = makeScores({ prevalence: 0.5, sep: 2, n: 4000 }), rare = makeScores({ prevalence: 0.02, sep: 2, n: 4000 });
  assert.ok(Math.abs(curves(common).auc - curves(rare).auc) < 0.05);
  assert.ok(confusion(rare, 1).precision < confusion(common, 1).precision - 0.4);
});
