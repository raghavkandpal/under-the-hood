// Dynamic programming via coin change: fewest coins to make an amount. No DOM.

/** Greedy: always take the biggest coin that fits. Fast, but not always optimal. */
export function greedy(coins, amount) {
  const out = []; let left = amount;
  for (const c of [...coins].sort((a, b) => b - a)) while (left >= c) { out.push(c); left -= c; }
  return left === 0 ? out : null;
}

/** Bottom-up DP: best[a] = 1 + min over coins c of best[a - c]. Returns the table and the reconstructed coins. */
export function dp(coins, amount) {
  const best = new Array(amount + 1).fill(Infinity), pick = new Array(amount + 1).fill(0); best[0] = 0;
  for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a && best[a - c] + 1 < best[a]) { best[a] = best[a - c] + 1; pick[a] = c; }
  const out = []; if (best[amount] < Infinity) for (let a = amount; a > 0; a -= pick[a]) out.push(pick[a]);
  return { best, pick, coins: best[amount] < Infinity ? out : null };
}

/** Count calls made by plain recursion vs memoised recursion (plain is capped to stay responsive). */
export function calls(coins, amount, cap = 5e6) {
  let plain = 0;
  const rec = a => { if (++plain > cap) throw 0; if (a === 0) return 0; let b = Infinity; for (const c of coins) if (c <= a) b = Math.min(b, 1 + rec(a - c)); return b; };
  let capped = false; try { rec(amount); } catch { capped = true; }
  let memo = 0; const seen = new Map();
  const mrec = a => { memo++; if (a === 0) return 0; if (seen.has(a)) return seen.get(a); let b = Infinity; for (const c of coins) if (c <= a) b = Math.min(b, 1 + mrec(a - c)); seen.set(a, b); return b; };
  mrec(amount);
  return { plain, capped, memo };
}
