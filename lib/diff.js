// Line/char diff via longest common subsequence (dynamic programming), with the edit-graph path for drawing. No DOM.

/** dp[i][j] = LCS length of a[i:] and b[j:] (suffix form makes the forward walk greedy-friendly). */
export function lcsTable(a, b) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  return dp;
}

/** Edit script: [{op: "=", "-", "+", a?, b?, i, j}]. Prefers deletions before insertions, like most diff tools. */
export function diff(a, b) {
  const dp = lcsTable(a, b), out = []; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ op: "=", a: a[i], b: b[j], i, j }); i++; j++; }
    else if (j >= b.length || (i < a.length && dp[i + 1][j] >= dp[i][j + 1])) { out.push({ op: "-", a: a[i], i, j }); i++; }
    else { out.push({ op: "+", b: b[j], i, j }); j++; }
  }
  return out;
}

export function apply(a, script) { return script.filter(s => s.op !== "-").map(s => (s.op === "=" ? s.a : s.b)); }
export const stats = script => ({ same: script.filter(s => s.op === "=").length, del: script.filter(s => s.op === "-").length, ins: script.filter(s => s.op === "+").length });

/** Unified-diff style hunks with `context` unchanged lines around each change. */
export function hunks(script, context = 2) {
  const changed = script.map((s, k) => (s.op !== "=" ? k : -1)).filter(k => k >= 0);
  if (!changed.length) return [];
  const ranges = [];
  for (const k of changed) { const lo = Math.max(0, k - context), hi = Math.min(script.length - 1, k + context); if (ranges.length && lo <= ranges.at(-1)[1] + 1) ranges.at(-1)[1] = hi; else ranges.push([lo, hi]); }
  return ranges.map(([lo, hi]) => {
    const part = script.slice(lo, hi + 1), first = part[0];
    const aStart = first.i + 1, bStart = first.j + 1;
    const aLen = part.filter(s => s.op !== "+").length, bLen = part.filter(s => s.op !== "-").length;
    return { header: `@@ -${aStart},${aLen} +${bStart},${bLen} @@`, lines: part };
  });
}
