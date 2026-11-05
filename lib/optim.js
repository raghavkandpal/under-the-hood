// 2-D loss surfaces (gradients come from the autograd engine) and classic optimizers. No DOM.
import { V } from "./autograd.js";

const sq = v => v.mul(v);
export const SURFACES = {
  bowl: { label: "Round bowl", range: [-3, 3, -2.2, 2.2], start: [-2.4, 1.7], min: [0, 0],
    f: (x, y) => sq(x).add(sq(y)).mul(0.5) },
  valley: { label: "Narrow valley", range: [-3, 3, -2.2, 2.2], start: [-2.6, 1.2], min: [0, 0],
    f: (x, y) => sq(x).mul(0.05).add(sq(y).mul(2)) },
  rosenbrock: { label: "Banana (Rosenbrock)", range: [-2, 2, -1, 3], start: [-1.6, 2.6], min: [1, 1],
    f: (x, y) => sq(V.of(1).sub(x)).add(sq(y.sub(sq(x))).mul(20)).mul(0.25) },
  bumpy: { label: "Two valleys", range: [-3, 3, -2.2, 2.2], start: [-2.5, -1.6], min: [1.142, 0.191], local: [-1.133, 0.947],
    f: (x, y) => {
      const g1 = sq(x.sub(1.2)).add(sq(y.sub(0.2))).neg().exp().mul(1.6);
      const g2 = sq(x.add(1.2)).add(sq(y.sub(1))).mul(-1.5).exp().mul(1.0);
      return sq(x).add(sq(y)).mul(0.08).sub(g1).sub(g2).add(1.6);
    } },
  saddle: { label: "Saddle point", range: [-2.5, 2.5, -2.2, 2.2], start: [-2.2, 0.02], min: [0, 1.414],
    f: (x, y) => sq(x).mul(0.5).sub(sq(y)).add(sq(sq(y)).mul(0.25)).add(1) },
};

export function evalAt(surface, x, y) {
  const X = new V(x), Y = new V(y), out = SURFACES[surface].f(X, Y);
  out.backward();
  return { f: out.data, g: [X.grad, Y.grad] };
}
export function valueAt(surface, x, y) { return SURFACES[surface].f(new V(x), new V(y)).data; }

export const OPTIMIZERS = {
  sgd: { label: "Gradient descent", init: () => ({}), step: (s, p, g, lr) => [p[0] - lr * g[0], p[1] - lr * g[1]] },
  momentum: { label: "Momentum", init: () => ({ v: [0, 0] }), step: (s, p, g, lr) => {
    s.v = s.v.map((v, i) => 0.9 * v + g[i]); return p.map((x, i) => x - lr * s.v[i]); } },
  rmsprop: { label: "RMSProp", init: () => ({ s: [0, 0] }), step: (s, p, g, lr) => {
    s.s = s.s.map((v, i) => 0.9 * v + 0.1 * g[i] * g[i]); return p.map((x, i) => x - lr * 0.1 * g[i] / (Math.sqrt(s.s[i]) + 1e-8)); } },
  adam: { label: "Adam", init: () => ({ m: [0, 0], v: [0, 0], t: 0 }), step: (s, p, g, lr) => {
    s.t++; const b1 = 0.9, b2 = 0.999;
    s.m = s.m.map((m, i) => b1 * m + (1 - b1) * g[i]);
    s.v = s.v.map((v, i) => b2 * v + (1 - b2) * g[i] * g[i]);
    return p.map((x, i) => { const mh = s.m[i] / (1 - b1 ** s.t), vh = s.v[i] / (1 - b2 ** s.t); return x - lr * 0.1 * mh / (Math.sqrt(vh) + 1e-8); }); } },
};

/** Run `steps` iterations; returns the path [[x, y, f], ...]. noise adds Gaussian jitter to the gradient (like minibatches). */
export function run(surface, opt, start, { lr = 0.1, steps = 200, noise = 0, rnd = Math.random } = {}) {
  const O = OPTIMIZERS[opt], state = O.init();
  let p = start.slice();
  const path = [[...p, valueAt(surface, ...p)]];
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  for (let i = 0; i < steps; i++) {
    const { g } = evalAt(surface, ...p);
    const gn = noise ? g.map(v => v + noise * gauss()) : g;
    p = O.step(state, p, gn, lr);
    const f = valueAt(surface, ...p);
    if (!Number.isFinite(f) || Math.abs(p[0]) > 1e6 || Math.abs(p[1]) > 1e6) { path.push([...p, Infinity]); break; }
    path.push([...p, f]);
  }
  return path;
}
