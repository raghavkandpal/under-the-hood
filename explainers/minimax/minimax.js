// Minimax with optional alpha-beta pruning, on tic-tac-toe. A board is 9 cells of "X", "O" or null. No DOM.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? "draw" : null;
}
export const other = p => (p === "X" ? "O" : "X");

/**
 * Best score for `player` to move, from X's point of view: positive means X wins, sooner wins score higher.
 * Returns { score, move, nodes }, where nodes counts every position looked at.
 */
export function search(b, player, { prune = true } = {}) {
  let nodes = 0;
  function go(b, p, depth, alpha, beta) {
    nodes++;
    const w = winner(b);
    if (w) return { score: w === "X" ? 10 - depth : w === "O" ? depth - 10 : 0, move: null };
    let best = { score: p === "X" ? -Infinity : Infinity, move: null };
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = p; const s = go(b, other(p), depth + 1, alpha, beta).score; b[i] = null;
      if (p === "X" ? s > best.score : s < best.score) best = { score: s, move: i };
      if (prune) { if (p === "X") alpha = Math.max(alpha, s); else beta = Math.min(beta, s); if (alpha >= beta) break; }
    }
    return best;
  }
  const r = go([...b], player, 0, -Infinity, Infinity);
  return { ...r, nodes };
}

/** The value of each empty cell if `player` moves there, assuming perfect play afterwards. */
export const moveScores = (b, player) => b.map((c, i) => { if (c) return null; const n = [...b]; n[i] = player; const w = winner(n);
  return w ? (w === "X" ? 9 : w === "O" ? -9 : 0) : search(n, other(player)).score; });
