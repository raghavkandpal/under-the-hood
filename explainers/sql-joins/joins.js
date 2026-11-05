// SQL joins: what each kind returns, and three algorithms with their cost. No DOM.
// rows: arrays of objects; key: column name shared by both sides.

/** Logical result of a join. kind: inner | left | right | full | cross. Unmatched sides become null. */
export function join(L, R, key, kind = "inner") {
  if (kind === "cross") return L.flatMap(l => R.map(r => ({ l, r })));
  const out = [], usedR = new Set();
  for (const l of L) {
    let hit = false;
    R.forEach((r, j) => { if (l[key] != null && l[key] === r[key]) { out.push({ l, r }); usedR.add(j); hit = true; } });
    if (!hit && (kind === "left" || kind === "full")) out.push({ l, r: null });
  }
  if (kind === "right" || kind === "full") R.forEach((r, j) => { if (!usedR.has(j)) out.push({ l: null, r }); });
  return out;
}

/** Nested loop: compare every pair. */
export function nestedLoop(L, R, key) {
  let ops = 0; const out = [];
  for (const l of L) for (const r of R) { ops++; if (l[key] != null && l[key] === r[key]) out.push({ l, r }); }
  return { out, ops };
}

/** Hash join: build a hash table on the smaller side, probe with the other. */
export function hashJoin(L, R, key) {
  let ops = 0; const [build, probe, swap] = L.length <= R.length ? [L, R, false] : [R, L, true], table = new Map();
  for (const b of build) { ops++; if (b[key] == null) continue; if (!table.has(b[key])) table.set(b[key], []); table.get(b[key]).push(b); }
  const out = [];
  for (const p of probe) { ops++; for (const b of table.get(p[key]) || []) out.push(swap ? { l: p, r: b } : { l: b, r: p }); }
  return { out, ops, memory: build.length };
}

/** Sort-merge join: sort both (≈ n log n each, skipped if already sorted), then walk them together. */
export function mergeJoin(L, R, key, { sorted = false } = {}) {
  const lg = n => (n > 1 ? Math.ceil(n * Math.log2(n)) : 0);
  let ops = sorted ? 0 : lg(L.length) + lg(R.length);
  const by = (x, y) => cmp(x[key], y[key]);
  const a = L.filter(x => x[key] != null).sort(by), b = R.filter(x => x[key] != null).sort(by), out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    ops++; const c = cmp(a[i][key], b[j][key]);
    if (c < 0) i++;
    else if (c > 0) j++;
    else {
      const k = a[i][key]; let j2 = j;
      while (j2 < b.length && b[j2][key] === k) j2++;
      while (i < a.length && a[i][key] === k) { for (let t = j; t < j2; t++) out.push({ l: a[i], r: b[t] }); i++; }
      j = j2;
    }
  }
  return { out, ops };
}
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
