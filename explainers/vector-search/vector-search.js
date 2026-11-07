// Approximate nearest-neighbour search with an inverted-file (IVF) index: cluster the vectors, and at query time
// scan only the few clusters whose centres are nearest. 2-D points so it can be drawn. No DOM.

import { run } from "../../shared/kmeans.js";

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** Points in a few uneven clumps, like real embeddings. */
export function points(n, rnd) {
  const centres = Array.from({ length: 8 }, () => [rnd(), rnd()]);
  return Array.from({ length: n }, () => { const c = centres[Math.floor(rnd() * centres.length)], s = 0.03 + 0.09 * rnd(); return [c[0] + s * (rnd() - 0.5) * 2, c[1] + s * (rnd() - 0.5) * 2]; });
}

/** k-means centres, and each point's cluster as a list per centre. */
export function buildIndex(data, k, seed = 1) {
  const { C, labels } = run(data, k, "plusplus", seed, 30), lists = C.map(() => []);
  labels.forEach((l, i) => lists[l].push(i));
  return { data, centres: C, lists };
}

export const exact = (data, q, k) => data.map((p, i) => [d2(p, q), i]).sort((a, b) => a[0] - b[0]).slice(0, k).map(x => x[1]);

/** Scan the `probes` nearest clusters only. Returns the top-k ids found, how many points were scanned, and which clusters. */
export function search(index, q, k, probes) {
  const order = index.centres.map((c, j) => [d2(c, q), j]).sort((a, b) => a[0] - b[0]).slice(0, probes).map(x => x[1]);
  const cand = order.flatMap(j => index.lists[j]);
  return { ids: cand.map(i => [d2(index.data[i], q), i]).sort((a, b) => a[0] - b[0]).slice(0, k).map(x => x[1]), scanned: cand.length, probed: order };
}
export const recall = (found, truth) => found.filter(i => truth.includes(i)).length / truth.length;
