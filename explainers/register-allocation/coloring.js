// Graph colouring for register allocation: live ranges → interference graph → colour with k registers, spilling the rest. No DOM.
// ranges: { name: [start, end] } (live from the line it's defined to the line it's last used, inclusive start, exclusive end)

/** Two variables interfere if both are alive at the same time. */
export function interference(ranges) {
  const names = Object.keys(ranges), adj = Object.fromEntries(names.map(n => [n, new Set()]));
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const [a, b] = [ranges[names[i]], ranges[names[j]]];
    if (a[0] < b[1] && b[0] < a[1]) { adj[names[i]].add(names[j]); adj[names[j]].add(names[i]); }
  }
  return adj;
}

/** Most variables alive at once: a lower bound on registers needed (and, for straight-line code, exactly the number needed). */
export function maxPressure(ranges) {
  const ev = []; for (const [s, e] of Object.values(ranges)) ev.push([s, 1], [e, -1]);
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); let cur = 0, best = 0;
  for (const [, d] of ev) { cur += d; best = Math.max(best, cur); }
  return best;
}

/** Visiting orders. */
export const ORDERS = {
  start: "By start (linear scan)",
  degree: "Most conflicts first",
  name: "Alphabetical",
  dsatur: "DSatur",
};

/** Greedy colouring with at most k colours. Uncolourable nodes are spilled (colour null). */
export function colour(adj, { order = "start", k = Infinity, ranges = null } = {}) {
  const names = Object.keys(adj), col = {}, spilled = [];
  const pick = n => { const used = new Set([...adj[n]].map(m => col[m]).filter(c => c != null)); let c = 0; while (used.has(c)) c++; return c < k ? c : null; };
  const assign = n => { const c = pick(n); col[n] = c; if (c == null) spilled.push(n); };
  if (order === "dsatur") {
    const left = new Set(names);
    while (left.size) {
      let best = null, bs = -1, bd = -1;
      for (const n of [...left].sort()) {
        const sat = new Set([...adj[n]].map(m => col[m]).filter(c => c != null)).size, deg = [...adj[n]].filter(m => left.has(m)).length;
        if (sat > bs || (sat === bs && deg > bd)) { best = n; bs = sat; bd = deg; }
      }
      assign(best); left.delete(best);
    }
  } else {
    const seq = [...names].sort((a, b) =>
      order === "start" && ranges ? ranges[a][0] - ranges[b][0] || a.localeCompare(b)
      : order === "degree" ? adj[b].size - adj[a].size || a.localeCompare(b)
      : a.localeCompare(b));
    seq.forEach(assign);
  }
  const used = new Set(Object.values(col).filter(c => c != null)).size;
  return { col, spilled, used };
}

/** True if no two neighbours share a colour. */
export function valid(adj, col) {
  for (const [n, ns] of Object.entries(adj)) for (const m of ns) if (col[n] != null && col[n] === col[m]) return false;
  return true;
}
