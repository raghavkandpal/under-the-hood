// Activation functions shared by the ML explainers. No DOM.

/** Softmax with temperature; non-finite scores (masked, -Infinity) get weight 0. */
export function softmax(xs, temp = 1) {
  const fin = xs.filter(Number.isFinite);
  if (!fin.length) return xs.map(() => 0);
  const m = Math.max(...fin), e = xs.map(x => (Number.isFinite(x) ? Math.exp((x - m) / temp) : 0)), s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

export const sigmoid = z => 1 / (1 + Math.exp(-z));
