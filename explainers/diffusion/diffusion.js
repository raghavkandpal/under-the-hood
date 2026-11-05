// Diffusion models in 2-D: noise data step by step, then run time backwards with a denoiser. No DOM.
// The denoiser here is the exact optimum for a finite training set (a softmax-weighted average of training points),
// with a "blur" knob standing in for a network that can't memorise perfectly.

/** Fraction of signal left at time t ∈ [0,1] (cosine schedule). */
export const alphaBar = t => Math.cos(((Math.min(t, 1) + 0.008) / 1.008) * Math.PI / 2) ** 2 / Math.cos((0.008 / 1.008) * Math.PI / 2) ** 2;

export function gauss(rnd) { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); }

/** Forward process: jump straight to time t. */
export function noisy(x0, t, eps) { const a = alphaBar(t); return [Math.sqrt(a) * x0[0] + Math.sqrt(1 - a) * eps[0], Math.sqrt(a) * x0[1] + Math.sqrt(1 - a) * eps[1]]; }

/** Best guess of the clean point given a noisy one. blur ≥ 0 widens the kernel (less memorisation). */
export function denoise(xt, t, data, blur = 0) {
  const a = Math.max(alphaBar(t), 1e-6), sa = Math.sqrt(a), v = (1 - a) + blur * blur * a;
  let m = -Infinity; const ls = data.map(d => { const l = -((xt[0] - sa * d[0]) ** 2 + (xt[1] - sa * d[1]) ** 2) / (2 * v); if (l > m) m = l; return l; });
  let z = 0, x = 0, y = 0; ls.forEach((l, i) => { const w = Math.exp(l - m); z += w; x += w * data[i][0]; y += w * data[i][1]; });
  return [x / z, y / z];
}

/** One deterministic (DDIM) step from t to s < t. */
export function stepBack(xt, t, s, data, blur = 0) {
  const at = alphaBar(t), as = alphaBar(s), x0 = denoise(xt, t, data, blur);
  const eps = [(xt[0] - Math.sqrt(at) * x0[0]) / Math.sqrt(1 - at), (xt[1] - Math.sqrt(at) * x0[1]) / Math.sqrt(1 - at)];
  return { x: [Math.sqrt(as) * x0[0] + Math.sqrt(1 - as) * eps[0], Math.sqrt(as) * x0[1] + Math.sqrt(1 - as) * eps[1]], x0 };
}

/** Generate: start from pure noise and walk back in `steps` steps. Returns the trajectory of every particle. */
export function sample(data, n, { steps = 40, blur = 0, rnd = Math.random, tMax = 0.999 } = {}) {
  let xs = Array.from({ length: n }, () => [gauss(rnd), gauss(rnd)]); const traj = [xs];
  for (let k = steps; k > 0; k--) { const t = tMax * k / steps, s = tMax * (k - 1) / steps; xs = xs.map(x => stepBack(x, t, s, data, blur).x); traj.push(xs); }
  return traj;
}

/** Distance from p to the nearest training point. */
export const nearestDist = (p, data) => Math.min(...data.map(d => Math.hypot(p[0] - d[0], p[1] - d[1])));

/** Training shapes, roughly within [-1.6, 1.6]². */
export function shape(name, n = 160, rnd = Math.random) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const u = i / n, j = () => (rnd() - 0.5) * 0.05;
    if (name === "spiral") { const a = 1 + u * 9, r = 0.15 + u * 1.3; P.push([r * Math.cos(a) + j(), r * Math.sin(a) + j()]); }
    else if (name === "moons") { const up = i % 2, a = Math.PI * (2 * i / n % 1); P.push(up ? [Math.cos(a) - 0.5 + j(), Math.sin(a) - 0.25 + j()] : [0.5 - Math.cos(a) + j(), 0.25 - Math.sin(a) + j()]); }
    else if (name === "smile") {
      const k = i % 4, a = 2 * Math.PI * u;
      if (k < 2) P.push([1.4 * Math.cos(a * 2) + j(), 1.4 * Math.sin(a * 2) + j()]);
      else if (k === 2) { const b = Math.PI * (1.15 + 0.7 * ((i * 7) % n) / n); P.push([0.85 * Math.cos(b) + j(), 0.85 * Math.sin(b) + j()]); }
      else P.push([(i % 8 < 4 ? -0.5 : 0.5) + 0.12 * Math.cos(a * 9) + j(), 0.5 + 0.12 * Math.sin(a * 9) + j()]);
    }
  }
  return P;
}
