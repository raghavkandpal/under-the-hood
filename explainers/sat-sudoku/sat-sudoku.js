// Constraint solving on Sudoku: plain backtracking vs propagation + "most constrained cell first". No DOM.
// A grid is 81 numbers, 0 = empty. Cells are indexed row by row.

const ROW = i => Math.floor(i / 9), COL = i => i % 9, BOX = i => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set(); for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j); return [...s];
});
const UNITS = [...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)), ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)))];

/** Digits still allowed in cell i, as a list. */
export function candidates(g, i) { if (g[i]) return []; const used = new Set(PEERS[i].map(j => g[j])); return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d)); }

export function valid(g) {
  for (const u of UNITS) { const v = u.map(i => g[i]).filter(Boolean); if (new Set(v).size !== v.length) return false; } return true;
}
export const complete = g => g.every(Boolean) && valid(g);

/** Fill forced cells until nothing changes: naked singles (one candidate) and hidden singles (only place in a unit for a digit).
 *  Returns the list of cells it filled, or null on a contradiction. */
export function propagate(g, log = null) {
  const filled = [];
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const c = candidates(g, i); if (!c.length) return null;
      if (c.length === 1) { g[i] = c[0]; filled.push(i); log?.push({ t: "force", i, v: c[0] }); changed = true; }
    }
    for (const u of UNITS) for (let d = 1; d <= 9; d++) {
      if (u.some(i => g[i] === d)) continue;
      const spots = u.filter(i => !g[i] && candidates(g, i).includes(d));
      if (!spots.length) return null;
      if (spots.length === 1) { g[spots[0]] = d; filled.push(spots[0]); log?.push({ t: "force", i: spots[0], v: d }); changed = true; }
    }
  }
  return filled;
}

/**
 * Backtracking search. opts: { propagate, mrv, limit (max guesses), count (stop after this many solutions), trace (record events, capped), rnd (shuffle digit order) }
 * Returns { solution, solutions, guesses, backtracks, gaveUp, trace }.
 */
export function solve(grid, { propagate: prop = false, mrv = false, limit = 2e6, count = 1, trace = false, rnd = null } = {}) {
  const g = [...grid], st = { guesses: 0, backtracks: 0, solutions: 0, solution: null, gaveUp: false, trace: trace ? [] : null };
  const log = e => { if (st.trace && st.trace.length < 30000) st.trace.push(e); };
  const pick = () => {
    if (!mrv) { const i = g.indexOf(0); return i < 0 ? null : { i, c: candidates(g, i) }; }
    let best = null; for (let i = 0; i < 81; i++) if (!g[i]) { const c = candidates(g, i); if (!best || c.length < best.c.length) best = { i, c }; if (c.length <= 1) break; }
    return best;
  };
  const rec = () => {
    // propagation fills cells in place; snapshot so every failing return can put them back
    const snap = prop ? g.slice() : null;
    const restore = () => { if (!snap) return; for (let i = 0; i < 81; i++) if (g[i] !== snap[i]) { g[i] = snap[i]; log({ t: "undo", i }); } };
    if (prop) { const tr = st.trace && st.trace.length < 30000 ? [] : null; const forced = propagate(g, tr); if (tr) tr.forEach(log); if (!forced) { restore(); return false; } }
    const p = pick();
    if (!p) { st.solutions++; if (!st.solution) st.solution = [...g]; if (st.solutions >= count) return true; restore(); return false; }
    const digits = rnd ? [...p.c].sort(() => rnd() - 0.5) : p.c;
    for (const d of digits) {
      if (++st.guesses > limit) { st.gaveUp = true; return true; }
      g[p.i] = d; log({ t: "guess", i: p.i, v: d });
      if (rec()) return true;
      g[p.i] = 0; st.backtracks++; log({ t: "undo", i: p.i });
    }
    restore();
    return false;
  };
  if (!valid(g)) return { ...st, solution: null };
  rec(); return st;
}

/** Make a puzzle with a unique solution: fill a random grid, then remove clues while the answer stays unique. */
export function generate(seed = 1, clues = 26) {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const full = solve(new Array(81).fill(0), { propagate: true, mrv: true, rnd }).solution, g = [...full];
  const order = Array.from({ length: 81 }, (_, i) => i).sort(() => rnd() - 0.5);
  let left = 81;
  for (const i of order) {
    if (left <= clues) break;
    const keep = g[i]; g[i] = 0;
    if (solve(g, { propagate: true, mrv: true, count: 2 }).solutions !== 1) g[i] = keep; else left--;
  }
  return { puzzle: g, solution: full };
}
