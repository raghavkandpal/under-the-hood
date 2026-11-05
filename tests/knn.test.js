import { test } from "node:test";
import assert from "node:assert/strict";
import { predict, looAccuracy, contrast, nearest } from "../lib/knn.js";
import { mulberry } from "../lib/autograd.js";

const pts = [{ x: [0, 0], label: "a" }, { x: [1, 0], label: "a" }, { x: [0, 1], label: "a" }, { x: [5, 5], label: "b" }, { x: [6, 5], label: "b" }, { x: [5, 6], label: "b" }];

test("classifies by nearby majority", () => {
  assert.equal(predict(pts, [0.5, 0.5], 3).label, "a");
  assert.equal(predict(pts, [5.2, 5.2], 3).label, "b");
  assert.equal(nearest(pts, [0, 0], 1)[0].i, 0);
});

test("k = 1 memorises noise; larger k smooths it out", () => {
  const rnd = mulberry(3), P = [];
  for (let i = 0; i < 120; i++) { const x = [rnd() * 2 - 1, rnd() * 2 - 1]; let label = x[0] + x[1] > 0 ? "b" : "a"; if (rnd() < 0.15) label = label === "a" ? "b" : "a"; P.push({ x, label }); }
  assert.equal(predict(P, P[0].x, 1).label, P[0].label); // training accuracy of 1-NN is perfect
  assert.ok(looAccuracy(P, 9) > looAccuracy(P, 1), `${looAccuracy(P, 9)} vs ${looAccuracy(P, 1)}`);
});

test("in high dimensions nearest and farthest look alike", () => {
  const rnd = mulberry(1); assert.ok(contrast(2, 200, rnd) < 0.1); assert.ok(contrast(500, 200, rnd) > 0.6);
});
