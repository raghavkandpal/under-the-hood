// Quantising neural-network weights to few bits: symmetric absmax per group, round-trip error, memory. No DOM.

/** Quantise w to signed `bits`-bit integers with one scale per group of `group` weights (group = Infinity → one scale per tensor). */
export function quantize(w, bits, group = Infinity) {
  const qmax = 2 ** (bits - 1) - 1, q = new Int32Array(w.length), scales = [];
  const g = Math.min(group, w.length);
  for (let s = 0; s < w.length; s += g) {
    let m = 0; for (let i = s; i < Math.min(s + g, w.length); i++) m = Math.max(m, Math.abs(w[i]));
    const scale = m / qmax || 1; scales.push(scale);
    for (let i = s; i < Math.min(s + g, w.length); i++) q[i] = Math.max(-qmax, Math.min(qmax, Math.round(w[i] / scale)));
  }
  return { q, scales, group: g, bits };
}

export function dequantize({ q, scales, group }) { return Float64Array.from(q, (v, i) => v * scales[Math.floor(i / group)]); }

/** Root-mean-square error, relative to the RMS of the weights. */
export function relError(w, wq) {
  let e = 0, s = 0; for (let i = 0; i < w.length; i++) { e += (w[i] - wq[i]) ** 2; s += w[i] ** 2; } return Math.sqrt(e / s);
}

/** How many distinct quantisation levels are actually used (fewer → wasted bits). */
export function levelsUsed({ q }) { return new Set(q).size; }

/** Bits per weight including the scales (one 16-bit scale per group). */
export const bitsPerWeight = (bits, group) => bits + (Number.isFinite(group) ? 16 / group : 0);

/** Model memory in GB for `params` billion parameters. */
export const modelGB = (params, bpw) => (params * 1e9 * bpw) / 8 / 1e9;

/** Synthetic layer weights: mostly small Gaussian, with a few large outliers like real LLM weights. */
export function weights(n, rnd, { outliers = 0.002, outlierScale = 12 } = {}) {
  const g = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  return Float64Array.from({ length: n }, () => g() * 0.02 * (rnd() < outliers ? outlierScale : 1));
}
