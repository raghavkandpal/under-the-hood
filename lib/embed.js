// Small, hand-built word embeddings with readable dimensions, cosine similarity, analogies and PCA. No DOM.

export const DIMS = ["royal", "male", "female", "adult", "young", "animal", "person", "food", "sweet", "city", "country", "europe", "asia", "big", "vehicle", "fast"];
const v = o => DIMS.map(d => o[d] ?? 0);
export const CATEGORY = {};
const W = {};
const add = (cat, words) => { for (const [w, o] of Object.entries(words)) { W[w] = v(o); CATEGORY[w] = cat; } };

add("people", {
  king: { royal: 1, male: 1, adult: 1, person: 1 }, queen: { royal: 1, female: 1, adult: 1, person: 1 },
  prince: { royal: 1, male: 1, young: 0.8, person: 1 }, princess: { royal: 1, female: 1, young: 0.8, person: 1 },
  man: { male: 1, adult: 1, person: 1 }, woman: { female: 1, adult: 1, person: 1 },
  boy: { male: 1, young: 1, person: 1 }, girl: { female: 1, young: 1, person: 1 },
  uncle: { male: 1, adult: 1, person: 1, royal: 0.05 }, aunt: { female: 1, adult: 1, person: 1, royal: 0.05 },
});
add("animals", {
  dog: { animal: 1, adult: 0.5 }, puppy: { animal: 1, young: 1 }, cat: { animal: 1, adult: 0.5 }, kitten: { animal: 1, young: 1 },
  lion: { animal: 1, royal: 0.4, big: 0.7, male: 0.3 }, elephant: { animal: 1, big: 1 }, mouse: { animal: 1, fast: 0.4 }, horse: { animal: 1, big: 0.6, fast: 0.7 },
});
add("food", {
  cake: { food: 1, sweet: 1 }, cookie: { food: 1, sweet: 0.9 }, candy: { food: 0.8, sweet: 1 }, bread: { food: 1, sweet: 0.1 },
  cheese: { food: 1 }, soup: { food: 1 }, honey: { food: 0.8, sweet: 1 }, apple: { food: 1, sweet: 0.5 },
});
add("places", {
  paris: { city: 1, europe: 1 }, rome: { city: 1, europe: 1, royal: 0.1 }, tokyo: { city: 1, asia: 1, big: 0.3 },
  france: { country: 1, europe: 1 }, italy: { country: 1, europe: 1, royal: 0.1 }, japan: { country: 1, asia: 1 }, village: { city: 0.5, big: -0.3 },
});
add("vehicles", {
  car: { vehicle: 1, fast: 0.6 }, truck: { vehicle: 1, big: 0.8 }, bicycle: { vehicle: 0.8, young: 0.2 }, jet: { vehicle: 1, fast: 1, big: 0.5 }, train: { vehicle: 1, big: 0.7, fast: 0.6 },
});
export const WORDS = W;

export const norm = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0));
export const cosine = (a, b) => { const na = norm(a), nb = norm(b); return na && nb ? a.reduce((s, x, i) => s + x * b[i], 0) / (na * nb) : 0; };
export const addV = (a, b) => a.map((x, i) => x + b[i]);
export const subV = (a, b) => a.map((x, i) => x - b[i]);

export function nearest(vec, k = 5, exclude = []) {
  return Object.entries(W).filter(([w]) => !exclude.includes(w)).map(([w, x]) => ({ w, sim: cosine(vec, x) })).sort((a, b) => b.sim - a.sim).slice(0, k);
}
/** a is to b as c is to ? → b - a + c */
export function analogy(a, b, c, k = 3) { return nearest(addV(subV(W[b], W[a]), W[c]), k, [a, b, c]); }

/** Top-2 principal components by power iteration with deflation. Returns { coords: {word: [x, y]}, explained: [r1, r2] } */
export function pca2(words = Object.keys(W), iters = 200) {
  const X = words.map(w => W[w]), d = DIMS.length, mean = DIMS.map((_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const C = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + (r[i] - mean[i]) * (r[j] - mean[j]), 0) / (X.length - 1)));
  const trace = C.reduce((s, r, i) => s + r[i], 0), comps = [], vals = [];
  let M = C.map(r => r.slice());
  for (let c = 0; c < 2; c++) {
    let b = DIMS.map((_, i) => Math.sin(i + 1 + c));
    for (let t = 0; t < iters; t++) { const nb = M.map(r => r.reduce((s, x, j) => s + x * b[j], 0)); const n = norm(nb) || 1; b = nb.map(x => x / n); }
    const lam = b.reduce((s, x, i) => s + x * M[i].reduce((ss, y, j) => ss + y * b[j], 0), 0);
    comps.push(b); vals.push(lam);
    M = M.map((r, i) => r.map((x, j) => x - lam * b[i] * b[j]));
  }
  const coords = {};
  words.forEach((w, i) => { const cx = subV(X[i], mean); coords[w] = comps.map(p => p.reduce((s, x, j) => s + x * cx[j], 0)); });
  return { coords, explained: vals.map(l => l / trace), comps };
}
