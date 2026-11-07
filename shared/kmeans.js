// k-means (Lloyd's algorithm) with random or k-means++ initialisation. No DOM.
import { mulberry } from "./random.js";

const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export const SHAPES = {
  blobs3: { label: "3 blobs", gen: r => blobs(r, [[-1.2, -0.6], [1.1, -0.8], [0, 1.1]], 0.38, 60) },
  blobs5: { label: "5 blobs", gen: r => blobs(r, [[-1.5, -1], [1.4, -1.1], [0, 0], [-1.2, 1.3], [1.3, 1.2]], 0.3, 40) },
  uneven: { label: "Big + small blobs", gen: r => [...blobs(r, [[-0.8, 0]], 0.75, 150), ...blobs(r, [[1.6, 0.9], [1.6, -0.9]], 0.18, 20)] },
  rings: { label: "Ring around a blob", gen: r => [...blobs(r, [[0, 0]], 0.3, 60), ...Array.from({ length: 120 }, () => { const t = r() * 2 * Math.PI, R = 1.8 + gauss(r) * 0.08; return [R * Math.cos(t), R * Math.sin(t)]; })] },
  uniform: { label: "No real clusters", gen: r => Array.from({ length: 180 }, () => [r() * 4 - 2, r() * 4 - 2]) },
};
function blobs(r, centers, sd, per) { return centers.flatMap(c => Array.from({ length: per }, () => [c[0] + gauss(r) * sd, c[1] + gauss(r) * sd])); }

export function makePoints(shape, seed = 1) { return SHAPES[shape].gen(mulberry(seed)); }

export function init(points, k, method, seed = 1) {
  const r = mulberry(seed);
  if (method === "random") {
    const idx = new Set(); while (idx.size < Math.min(k, points.length)) idx.add(Math.floor(r() * points.length));
    return [...idx].map(i => points[i].slice());
  }
  // k-means++: next centre chosen with probability proportional to squared distance from nearest centre
  const C = [points[Math.floor(r() * points.length)].slice()];
  while (C.length < k) {
    const ds = points.map(p => Math.min(...C.map(c => d2(p, c)))), tot = ds.reduce((a, b) => a + b, 0);
    let u = r() * tot, i = 0; while (i < ds.length - 1 && (u -= ds[i]) > 0) i++;
    C.push(points[i].slice());
  }
  return C;
}

export function assign(points, C) { return points.map(p => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; b = j; } }); return b; }); }
export function update(points, labels, C) {
  return C.map((c, j) => {
    let x = 0, y = 0, n = 0;
    points.forEach((p, i) => { if (labels[i] === j) { x += p[0]; y += p[1]; n++; } });
    return n ? [x / n, y / n] : c.slice(); // empty cluster keeps its centre
  });
}
export const inertia = (points, labels, C) => points.reduce((s, p, i) => s + d2(p, C[labels[i]]), 0);

export function run(points, k, method, seed = 1, maxIter = 100) {
  let C = init(points, k, method, seed), labels = assign(points, C);
  const hist = [inertia(points, labels, C)];
  for (let it = 0; it < maxIter; it++) {
    const C2 = update(points, labels, C), L2 = assign(points, C2);
    C = C2; hist.push(inertia(points, L2, C));
    if (L2.every((l, i) => l === labels[i])) { labels = L2; break; }
    labels = L2;
  }
  return { C, labels, hist };
}
