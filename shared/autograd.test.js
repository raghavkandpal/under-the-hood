import { test } from "node:test";
import assert from "node:assert/strict";
import { V, MLP, trainStep, numericGrad, mulberry } from "./autograd.js";

const close = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

const exprs = {
  poly: ([a, b, c]) => a.mul(b).add(c.pow(3)).sub(a.div(b.add(3))),
  activations: ([a, b, c]) => a.tanh().mul(b.sigmoid()).add(c.relu()).add(a.mul(c).exp().log()),
  reuse: ([a, b]) => { const t = a.mul(b); return t.mul(t).add(t).mul(a); }, // same node used several times
};
const asNum = f => xs => f(xs.map(x => new V(x))).data;

for (const [name, f] of Object.entries(exprs)) {
  test(`gradients match finite differences: ${name}`, () => {
    const rnd = mulberry(name.length);
    for (let trial = 0; trial < 20; trial++) {
      const xs = [rnd() * 2 + 0.2, rnd() * 2 + 0.2, rnd() * 2 - 1];
      const vs = xs.map(x => new V(x));
      f(vs).backward();
      const num = numericGrad(asNum(f), xs);
      vs.forEach((v, i) => close(v.grad, num[i]));
    }
  });
}

test("MLP gradients match finite differences", () => {
  const m = new MLP([2, 4, 1], { seed: 3 });
  const x = [0.3, -0.7];
  const out = m.forward(x)[0].pow(2);
  out.backward();
  const ps = m.params();
  const f = vals => { ps.forEach((p, i) => p.data = vals[i]); return m.predict(x)[0] ** 2; };
  const orig = ps.map(p => p.data), analytic = ps.map(p => p.grad);
  const num = numericGrad(f, orig);
  f(orig);
  analytic.forEach((g, i) => close(g, num[i], 1e-3));
});

test("predict() matches forward()", () => {
  for (const act of ["tanh", "relu"]) {
    const m = new MLP([2, 5, 3, 1], { act, seed: 9 });
    close(m.predict([0.5, -1.2])[0], m.forward([0.5, -1.2])[0].data, 1e-12);
  }
});

test("learns XOR", () => {
  const X = [[-1, -1], [-1, 1], [1, -1], [1, 1]], y = [-1, 1, 1, -1];
  const m = new MLP([2, 6, 1], { seed: 2 });
  let r;
  for (let i = 0; i < 400; i++) r = trainStep(m, X, y, { lr: 0.2, l2: 0 });
  assert.equal(r.acc, 1);
  assert.ok(r.loss < 0.1, String(r.loss));
});

test("deep graphs don't overflow the stack", () => {
  let x = new V(1); const x0 = x;
  for (let i = 0; i < 20000; i++) x = x.mul(1.0001);
  x.backward();
  close(x0.grad, 1.0001 ** 20000, 1e-6);
});

test("trainStepFast matches autograd trainStep exactly", async () => {
  const { trainStepFast } = await import("./autograd.js");
  for (const act of ["tanh", "relu"]) for (const loss of ["logistic", "hinge"]) {
    const a = new MLP([2, 5, 4, 1], { act, seed: 11 }), b = new MLP([2, 5, 4, 1], { act, seed: 11 });
    const rnd = mulberry(3), X = Array.from({ length: 30 }, () => [rnd() * 4 - 2, rnd() * 4 - 2]), y = X.map(p => (p[0] * p[1] > 0 ? 1 : -1));
    for (let k = 0; k < 5; k++) {
      const ra = trainStep(a, X, y, { lr: 0.1, l2: 1e-3, loss }), rb = trainStepFast(b, X, y, { lr: 0.1, l2: 1e-3, loss });
      close(rb.loss, ra.loss, 1e-9); assert.equal(rb.acc, ra.acc);
    }
    a.params().forEach((p, i) => close(b.params()[i].data, p.data, 1e-9));
  }
});
