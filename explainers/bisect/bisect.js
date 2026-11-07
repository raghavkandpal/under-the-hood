// git bisect: binary search over history for the commit that broke something. Commit 0 is known good,
// commit n − 1 known bad. No DOM.

/** isBad(i) tests commit i; it returns true, false, or "skip" (can't be tested, e.g. it doesn't build). */
export function bisect(n, isBad) {
  let good = 0, bad = n - 1; const steps = [], skipped = new Set();
  while (bad - good > 1) {
    const mid = (good + bad) >> 1, i = pick(mid, good, bad, skipped);
    if (i === null) return { found: null, candidates: [...range(good + 1, bad + 1)], steps };
    const r = isBad(i); steps.push({ good, bad, test: i, result: r === "skip" ? "skip" : r ? "bad" : "good" });
    if (r === "skip") skipped.add(i); else if (r) bad = i; else good = i;
  }
  return { found: bad, steps };
}
/** The untested commit closest to the middle. */
function pick(mid, good, bad, skipped) {
  for (let d = 0; d < bad - good; d++) for (const i of [mid - d, mid + d]) if (i > good && i < bad && !skipped.has(i)) return i;
  return null;
}
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
