import { test } from "node:test";
import assert from "node:assert/strict";
import { sigmoid, train, predict } from "./logistic-regression.js";
import { mulberry } from "../../shared/random.js";

test("the sigmoid turns any score into a probability", () => {
  assert.equal(sigmoid(0), 0.5); assert.ok(sigmoid(6) > 0.997 && sigmoid(-6) < 0.003);
});

test("training separates two groups and recovers a known boundary", () => {
  // Pass if x + y > 1 (an independent rule the model must find).
  const pts = []; for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) pts.push({ x: i / 10, y: j / 10, label: i + j > 10 ? 1 : 0 });
  const m = train(pts, { steps: 3000, lr: 1 }), acc = pts.filter(p => (predict(m, p.x, p.y) > 0.5 ? 1 : 0) === p.label).length / pts.length;
  assert.ok(acc > 0.95, `${acc}`); assert.ok(Math.abs(m.w[0] / m.w[1] - 1) < 0.15, "the boundary has slope −1");
});


test("on noisy data the probabilities mean what they say", () => {
  const rnd = mulberry(1), pts = Array.from({ length: 4000 }, () => { const x = rnd(), y = rnd(); return { x, y, label: rnd() < sigmoid(6 * (x + y - 1)) ? 1 : 0 }; });
  const m = train(pts, { steps: 1500, lr: 2 }), band = pts.filter(p => { const q = predict(m, p.x, p.y); return q > 0.6 && q < 0.8; });
  const rate = band.filter(p => p.label).length / band.length; assert.ok(Math.abs(rate - 0.7) < 0.06, `${rate} of ${band.length}`);
  m.losses.reduce((a, b) => (assert.ok(b <= a + 1e-9), b));
});

test("perfectly separable groups push the weights up forever, unless L2 holds them back", () => {
  const pts = [{ x: 0.2, y: 0.2, label: 0 }, { x: 0.3, y: 0.1, label: 0 }, { x: 0.8, y: 0.9, label: 1 }, { x: 0.9, y: 0.7, label: 1 }];
  const short = train(pts, { steps: 500 }), long = train(pts, { steps: 5000 }), reg = train(pts, { steps: 5000, l2: 0.01 });
  assert.ok(Math.hypot(...long.w) > 1.5 * Math.hypot(...short.w)); assert.ok(Math.hypot(...reg.w) < Math.hypot(...long.w) / 2);
});
