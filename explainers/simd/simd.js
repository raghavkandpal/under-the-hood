// SIMD: one instruction working on several values at once. Lane counts, how a sum splits across lanes, why float
// sums change, branch-free masking, and loops that cannot be vectorised. No DOM.
import { run, bytes, cycles } from "../../shared/branch.js";
import { mulberry } from "../../shared/random.js";

export const lanes = (registerBits, elementBits) => registerBits / elementBits;

/** Instruction count for summing n values with `lanes` lanes: whole vectors, a scalar tail, then folding the lanes together. */
export function sumPlan(n, lanes) {
  const vectorAdds = Math.floor(n / lanes), tailAdds = n % lanes, combineAdds = lanes - 1;
  return { vectorAdds, tailAdds, combineAdds, total: vectorAdds + tailAdds + combineAdds, scalar: n };
}

/** Left to right, as written in the source. `add` is float32 or integer addition. */
export const scalarSum = (xs, add) => xs.reduce(add, 0);
/** What a vector loop does: lane j sums elements j, j+L, j+2L..., then the lanes are added in order, then the tail. */
export function laneSum(xs, L, add) {
  const body = xs.length - (xs.length % L), part = new Array(L).fill(0);
  for (let i = 0; i < body; i++) part[i % L] = add(part[i % L], xs[i]);
  return xs.slice(body).reduce(add, part.reduce(add, 0));
}
export const f32add = (a, b) => Math.fround(a + b);
export const intAdd = (a, b) => (a + b) | 0;

/** n values with mixed magnitudes, rounded to float32, or small integers. */
export function data(n, seed, kind) {
  const rnd = mulberry(seed);
  return Array.from({ length: n }, () => kind === "int" ? Math.floor(rnd() * 2000) - 1000 : Math.fround((rnd() - 0.5) * 10 ** (rnd() * 6)));
}

/** Scalar and lane-split sums of the same data. */
export function compareSums(n, L, seed, kind) {
  const xs = data(n, seed, kind), add = kind === "int" ? intAdd : f32add;
  const a = scalarSum(xs, add), b = laneSum(xs, L, add);
  return { scalar: a, lanes: b, same: a === b };
}

/** `if (x >= 128) sum += x`: the scalar loop's result and cycles (with real mispredictions), against compare + mask + add. */
export function maskedSum(n, seed, sorted, L = 8) {
  const xs = bytes(n, mulberry(seed), sorted), taken = xs.map(x => x >= 128);
  const branchy = xs.reduce((s, x) => (x >= 128 ? s + x : s), 0);
  const masked = laneSum(xs.map(x => x & -(x >= 128)), L, intAdd);   // the mask is all ones where true, all zeros where false
  const misses = run("twoBit", taken).hits.filter(h => !h).length;
  return { branchy, masked, misses, maskedMisses: 0,   // compare + AND + add has no branch to guess
     scalarCycles: cycles(n, misses), vectorCycles: 3 * (Math.floor(n / L) + (n % L)) + (L - 1) };
}

/** c[i] = a[i] + b[i] (independent) or a[i] = a[i-1] + b[i] (dependent): one element at a time, and L at a time. Within a block of L, every element reads the values from before the block started. */
export function carried(a, b, L, dependent) {
  const scalar = a.slice(), vector = a.slice();
  for (let i = 1; i < a.length; i++) scalar[i] = (dependent ? scalar[i - 1] : a[i]) + b[i];
  for (let s = 1; s < a.length; s += L) {
    const old = vector.slice();
    for (let i = s; i < Math.min(s + L, a.length); i++) vector[i] = (dependent ? old[i - 1] : old[i]) + b[i];
  }
  return { scalar, vector, same: scalar.every((v, i) => v === vector[i]) };
}

/** The page's starting controls: 256-bit registers of float32, 1,003 values, seed 1. */
export const DEFAULTS = { n: 1003, seed: 1, registerBits: 256, elementBits: 32, bytes: 4000 };
