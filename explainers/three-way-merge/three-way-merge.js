// Three-way merge (the diff3 idea): compare each side with the common ancestor, take each side's changes, and
// conflict only where both changed the same lines differently. Arrays of lines in, lines out. No DOM.

import { diff } from "../../shared/diff.js";

/** One side's changes as hunks over base line ranges: { start, end, lines } replaces base[start..end). */
export function hunks(base, side) {
  const out = []; let cur = null;
  for (const s of diff(base, side)) {
    if (s.op === "=") { cur = null; continue; }
    if (!cur) out.push(cur = { start: s.i, end: s.i, lines: [] });
    if (s.op === "-") cur.end = s.i + 1; else cur.lines.push(s.b);
  }
  return out;
}

/** Base lines from..to with the given hunks applied. */
const applyRange = (base, from, to, hs) => {
  const out = []; let i = from;
  for (const h of hs) { out.push(...base.slice(i, h.start), ...h.lines); i = h.end; }
  return [...out, ...base.slice(i, to)];
};

/** Returns the merged lines (with conflict markers), the conflict count, and each region for drawing. */
export function merge3(base, ours, theirs) {
  const all = [...hunks(base, ours).map(h => ({ ...h, side: "ours" })), ...hunks(base, theirs).map(h => ({ ...h, side: "theirs" }))].sort((a, b) => a.start - b.start || a.end - b.end);
  const lines = [], regions = []; let i = 0, conflicts = 0;
  for (let k = 0; k < all.length;) {
    // Group hunks whose base ranges overlap or touch at the same insertion point.
    const group = [all[k]]; let end = all[k].end; k++;
    while (k < all.length && (all[k].start < end || (all[k].start === end && all[k].start === group[0].start))) { end = Math.max(end, all[k].end); group.push(all[k++]); }
    const start = group[0].start, o = group.filter(h => h.side === "ours"), t = group.filter(h => h.side === "theirs");
    lines.push(...base.slice(i, start)); if (start > i) regions.push({ kind: "same", lines: base.slice(i, start) });
    const mine = applyRange(base, start, end, o), yours = applyRange(base, start, end, t);
    if (!o.length || !t.length || mine.join("\n") === yours.join("\n")) {
      const take = o.length ? mine : yours; lines.push(...take);
      regions.push({ kind: !o.length ? "theirs" : !t.length ? "ours" : "both", lines: take });
    } else {
      conflicts++; lines.push("<<<<<<< ours", ...mine, "=======", ...yours, ">>>>>>> theirs");
      regions.push({ kind: "conflict", ours: mine, theirs: yours, base: base.slice(start, end) });
    }
    i = end;
  }
  lines.push(...base.slice(i)); if (i < base.length) regions.push({ kind: "same", lines: base.slice(i) });
  return { lines, conflicts, regions };
}
