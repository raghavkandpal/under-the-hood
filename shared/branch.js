// Branch-predictor models and the sorted-bytes loop, shared by branch-prediction and simd. No DOM.

/** Each predictor is a factory returning { predict(), update(taken) }. */
export const PREDICTORS = {
  static: () => ({ predict: () => true, update() {} }),
  oneBit: () => { let last = true; return { predict: () => last, update(t) { last = t; } }; },
  /** A saturating counter 0..3: two wrong guesses in a row are needed to flip the prediction. */
  twoBit: () => { let c = 2; return { predict: () => c >= 2, update(t) { c = t ? Math.min(3, c + 1) : Math.max(0, c - 1); } }; },
  /** A table of 2-bit counters indexed by the last `bits` outcomes, so it learns repeating patterns. */
  history: (bits = 8) => { let h = 0; const table = new Array(1 << bits).fill(2), mask = (1 << bits) - 1;
    return { predict: () => table[h] >= 2, update(t) { table[h] = t ? Math.min(3, table[h] + 1) : Math.max(0, table[h] - 1); h = ((h << 1) | t) & mask; } }; },
};

export function run(kind, outcomes, ...args) {
  const p = PREDICTORS[kind](...args), hits = outcomes.map(t => { const g = p.predict(); p.update(t); return g === t; });
  return { hits, missRate: hits.filter(h => !h).length / hits.length };
}

/** The classic loop: `if (data[i] >= 128) sum += data[i]` over random bytes, sorted or not. */
export function bytes(n, rnd, sorted) { const a = Array.from({ length: n }, () => Math.floor(rnd() * 256)); return sorted ? a.sort((x, y) => x - y) : a; }
/** Rough cost: one cycle per branch, plus a pipeline flush per miss. */
export const cycles = (n, misses, penalty = 15) => n + misses * penalty;
