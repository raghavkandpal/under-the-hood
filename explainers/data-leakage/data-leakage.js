// Data leakage: getting a great test score from data with no signal at all, by letting the test set influence training.
// Features and labels are pure noise, so any honest model scores about 50%. No DOM.

const gauss = rnd => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

/** n rows of p noise features, random 0/1 labels. */
export function noiseData({ n = 100, p = 1000, rnd }) {
  return { X: Array.from({ length: n }, () => Array.from({ length: p }, () => gauss(rnd))), y: Array.from({ length: n }, () => (rnd() < 0.5 ? 1 : 0)) };
}

/** The k features whose values differ most between the two classes, judged on the given rows. */
export function select(X, y, rows, k) {
  const p = X[0].length, score = [];
  for (let j = 0; j < p; j++) { let s1 = 0, n1 = 0, s0 = 0, n0 = 0; for (const i of rows) if (y[i]) { s1 += X[i][j]; n1++; } else { s0 += X[i][j]; n0++; } score.push([Math.abs(s1 / (n1 || 1) - s0 / (n0 || 1)), j]); }
  return score.sort((a, b) => b[0] - a[0]).slice(0, k).map(s => s[1]);
}

/** Nearest-centroid classifier on the chosen features. */
export function accuracy(X, y, train, test, feats) {
  const c = [0, 1].map(cls => { const rs = train.filter(i => y[i] === cls); return feats.map(j => rs.reduce((s, i) => s + X[i][j], 0) / (rs.length || 1)); });
  const d = (i, cls) => feats.reduce((s, j, k) => s + (X[i][j] - c[cls][k]) ** 2, 0);
  return test.filter(i => (d(i, 1) < d(i, 0) ? 1 : 0) === y[i]).length / test.length;
}

/**
 * leaky: choose features using every row, then split. honest: split first, choose features on the training rows only.
 * duplicates: copy some training rows into the test set (the same customer appearing twice).
 */
export function experiment({ mode, n = 100, p = 1000, k = 20, rnd }) {
  const { X, y } = noiseData({ n, p, rnd }), idx = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
  const train = idx.slice(0, n * 0.7), test = mode === "duplicates" ? [...idx.slice(n * 0.7), ...train.slice(0, 20)] : idx.slice(n * 0.7);
  const feats = select(X, y, mode === "leaky" ? idx : train, k);
  return accuracy(X, y, train, test, feats);
}
export function average(mode, runs, rnd, opts = {}) { let s = 0; for (let r = 0; r < runs; r++) s += experiment({ mode, rnd, ...opts }); return s / runs; }
