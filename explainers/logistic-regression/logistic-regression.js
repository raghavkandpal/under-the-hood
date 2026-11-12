// Logistic regression: a weighted score squashed into a probability, fitted by gradient descent on log loss. No DOM.
// Points are { x, y, label } with label 0 or 1.

import { sigmoid } from "../../shared/activations.js";
export { sigmoid };
export const predict = (m, x, y) => sigmoid(m.w[0] * x + m.w[1] * y + m.b);
/** Average log loss: small when confident and right, huge when confident and wrong. */
export const logLoss = (m, pts) => -pts.reduce((s, p) => { const q = Math.min(1 - 1e-12, Math.max(1e-12, predict(m, p.x, p.y))); return s + (p.label ? Math.log(q) : Math.log(1 - q)); }, 0) / pts.length;

/** Batch gradient descent. l2 shrinks the weights, which keeps them finite when the groups separate perfectly. */
export function train(pts, { steps = 2000, lr = 0.5, l2 = 0 } = {}) {
  const m = { w: [0, 0], b: 0 }, losses = [];
  for (let s = 0; s < steps; s++) {
    let g0 = 0, g1 = 0, gb = 0;
    for (const p of pts) { const e = predict(m, p.x, p.y) - p.label; g0 += e * p.x; g1 += e * p.y; gb += e; }
    const n = pts.length;
    m.w[0] -= lr * (g0 / n + l2 * m.w[0]); m.w[1] -= lr * (g1 / n + l2 * m.w[1]); m.b -= lr * gb / n;
    if (s % 20 === 0) losses.push(logLoss(m, pts));
  }
  return { ...m, losses };
}
