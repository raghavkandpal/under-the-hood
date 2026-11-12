// Branch prediction: guessing which way an `if` goes before the CPU knows. Predictors run over a sequence of
// outcomes (true = taken) and report each guess. No DOM.

import { bytes } from "../../shared/branch.js";
export { run, cycles } from "../../shared/branch.js";

export const PATTERNS = {
  sorted: (n, rnd) => bytes(n, rnd, true).map(x => x >= 128),
  random: (n, rnd) => bytes(n, rnd, false).map(x => x >= 128),
  alternating: n => Array.from({ length: n }, (_, i) => i % 2 === 0),
  loop: n => Array.from({ length: n }, (_, i) => i % 8 !== 7),   // an inner loop of 8: taken 7 times, then falls through
};
