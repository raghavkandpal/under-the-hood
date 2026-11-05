// A tiny scalar reverse-mode autodiff engine plus a minimal MLP. Small enough to read in one sitting,
// fast enough for toy networks in the browser. No DOM.

let nextId = 0;
export class V {
  constructor(data, prev = [], op = "", label = "") {
    this.data = data; this.grad = 0; this.prev = prev; this.op = op; this.label = label; this.id = nextId++;
    this._back = () => {};
  }
  static of(x) { return x instanceof V ? x : new V(x); }
  add(o) { o = V.of(o); const out = new V(this.data + o.data, [this, o], "+"); out._back = () => { this.grad += out.grad; o.grad += out.grad; }; return out; }
  mul(o) { o = V.of(o); const out = new V(this.data * o.data, [this, o], "×"); out._back = () => { this.grad += o.data * out.grad; o.grad += this.data * out.grad; }; return out; }
  pow(k) { const out = new V(this.data ** k, [this], `^${k}`); out._back = () => { this.grad += k * this.data ** (k - 1) * out.grad; }; return out; }
  neg() { return this.mul(-1); }
  sub(o) { return this.add(V.of(o).neg()); }
  div(o) { return this.mul(V.of(o).pow(-1)); }
  exp() { const e = Math.exp(this.data), out = new V(e, [this], "exp"); out._back = () => { this.grad += e * out.grad; }; return out; }
  log() { const out = new V(Math.log(this.data), [this], "log"); out._back = () => { this.grad += out.grad / this.data; }; return out; }
  tanh() { const t = Math.tanh(this.data), out = new V(t, [this], "tanh"); out._back = () => { this.grad += (1 - t * t) * out.grad; }; return out; }
  relu() { const out = new V(this.data > 0 ? this.data : 0, [this], "relu"); out._back = () => { this.grad += (this.data > 0 ? 1 : 0) * out.grad; }; return out; }
  sigmoid() { const s = 1 / (1 + Math.exp(-this.data)), out = new V(s, [this], "σ"); out._back = () => { this.grad += s * (1 - s) * out.grad; }; return out; }

  topo() {
    const order = [], seen = new Set();
    const stack = [[this, false]];
    while (stack.length) { // iterative DFS, safe for deep graphs
      const [v, done] = stack.pop();
      if (done) { order.push(v); continue; }
      if (seen.has(v)) continue; seen.add(v);
      stack.push([v, true]);
      for (const p of v.prev) if (!seen.has(p)) stack.push([p, false]);
    }
    return order;
  }
  backward() {
    const order = this.topo();
    for (const v of order) v.grad = 0;
    this.grad = 1;
    for (let i = order.length - 1; i >= 0; i--) order[i]._back();
    return order;
  }
}

export const sum = vs => vs.reduce((a, b) => a.add(b), new V(0));

// ---- a minimal MLP ----
export { mulberry } from "./random.js";
import { mulberry } from "./random.js";

export class MLP {
  /** sizes like [2, 8, 8, 1]; act: "tanh" | "relu"; last layer is linear. */
  constructor(sizes, { act = "tanh", seed = 1 } = {}) {
    const rnd = mulberry(seed);
    this.act = act; this.sizes = sizes;
    this.layers = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const nin = sizes[l], nout = sizes[l + 1], scale = Math.sqrt((act === "relu" ? 2 : 1) / nin);
      this.layers.push(Array.from({ length: nout }, () => ({
        w: Array.from({ length: nin }, () => new V((rnd() * 2 - 1) * scale * 1.7)),
        b: new V(0),
      })));
    }
  }
  params() { return this.layers.flatMap(L => L.flatMap(n => [...n.w, n.b])); }
  forward(x, { trace = false } = {}) {
    let h = x.map(V.of); const acts = trace ? [h] : null;
    this.layers.forEach((L, li) => {
      const last = li === this.layers.length - 1;
      h = L.map(n => { const z = sum(n.w.map((w, i) => w.mul(h[i]))).add(n.b); return last ? z : z[this.act](); });
      if (trace) acts.push(h);
    });
    return trace ? { out: h, acts } : h;
  }
  // fast numeric forward (no graph), for drawing decision boundaries
  predict(x) {
    let h = x;
    this.layers.forEach((L, li) => {
      const last = li === this.layers.length - 1;
      h = L.map(n => { let z = n.b.data; for (let i = 0; i < h.length; i++) z += n.w[i].data * h[i]; return last ? z : this.act === "relu" ? Math.max(0, z) : Math.tanh(z); });
    });
    return h;
  }
}

/** One step of gradient descent on binary classification (labels ±1) with hinge or logistic loss + L2. */
export function trainStep(model, X, y, { lr = 0.05, l2 = 1e-4, loss = "logistic" } = {}) {
  const outs = X.map(x => model.forward(x)[0]);
  const losses = outs.map((o, i) => loss === "hinge"
    ? o.mul(-y[i]).add(1).relu()
    : o.mul(-y[i]).exp().add(1).log());
  const params = model.params();
  const reg = sum(params.map(p => p.mul(p))).mul(l2);
  const total = sum(losses).div(X.length).add(reg);
  total.backward();
  for (const p of params) p.data -= lr * p.grad;
  const acc = outs.filter((o, i) => (o.data > 0 ? 1 : -1) === y[i]).length / X.length;
  return { loss: total.data, acc };
}

/**
 * Same maths as trainStep, but hand-written backprop over plain arrays: ~100× faster, no graph.
 * The tests check it produces identical updates to the autograd version.
 */
export function trainStepFast(model, X, y, { lr = 0.05, l2 = 1e-4, loss = "logistic" } = {}) {
  const Ls = model.layers, relu = model.act === "relu";
  const W = Ls.map(L => L.map(n => n.w.map(w => w.data))), B = Ls.map(L => L.map(n => n.b.data));
  const gW = W.map(L => L.map(r => new Float64Array(r.length))), gB = B.map(L => new Float64Array(L.length));
  let total = 0, correct = 0;
  const N = X.length;
  for (let s = 0; s < N; s++) {
    const hs = [X[s]], zs = [];
    for (let l = 0; l < Ls.length; l++) {
      const last = l === Ls.length - 1, prev = hs[l], z = new Float64Array(W[l].length), h = new Float64Array(W[l].length);
      for (let j = 0; j < W[l].length; j++) {
        let v = B[l][j]; const wr = W[l][j]; for (let i = 0; i < prev.length; i++) v += wr[i] * prev[i];
        z[j] = v; h[j] = last ? v : relu ? (v > 0 ? v : 0) : Math.tanh(v);
      }
      zs.push(z); hs.push(h);
    }
    const o = hs.at(-1)[0], t = y[s];
    if ((o > 0 ? 1 : -1) === t) correct++;
    let dout;
    if (loss === "hinge") { const m = 1 - t * o; total += m > 0 ? m : 0; dout = m > 0 ? -t : 0; }
    else { const u = -t * o; total += u > 30 ? u : Math.log1p(Math.exp(u)); dout = -t / (1 + Math.exp(-u)); }
    let delta = new Float64Array([dout / N]);
    for (let l = Ls.length - 1; l >= 0; l--) {
      const prev = hs[l], nd = new Float64Array(prev.length);
      for (let j = 0; j < delta.length; j++) {
        const dj = delta[j]; if (dj === 0) continue;
        gB[l][j] += dj; const wr = W[l][j], gr = gW[l][j];
        for (let i = 0; i < prev.length; i++) { gr[i] += dj * prev[i]; nd[i] += dj * wr[i]; }
      }
      if (l > 0) for (let i = 0; i < nd.length; i++) nd[i] *= relu ? (zs[l - 1][i] > 0 ? 1 : 0) : 1 - prev[i] * prev[i];
      delta = nd;
    }
  }
  let reg = 0;
  Ls.forEach((L, l) => L.forEach((n, j) => {
    n.w.forEach((w, i) => { reg += w.data * w.data; w.grad = gW[l][j][i] + 2 * l2 * w.data; });
    reg += n.b.data * n.b.data; n.b.grad = gB[l][j] + 2 * l2 * n.b.data;
  }));
  for (const p of model.params()) p.data -= lr * p.grad;
  return { loss: total / N + l2 * reg, acc: correct / N };
}

/** Numerical gradient check helper: f maps an array of numbers to a number. */
export function numericGrad(f, xs, h = 1e-6) {
  return xs.map((_, i) => { const a = xs.slice(), b = xs.slice(); a[i] += h; b[i] -= h; return (f(a) - f(b)) / (2 * h); });
}
