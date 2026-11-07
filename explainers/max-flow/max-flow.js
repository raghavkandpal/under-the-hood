// Maximum flow (Edmonds–Karp): push flow along shortest augmenting paths in the residual network until none is left.
// Edges are { from, to, cap }. No DOM.

/** The network from CLRS figure 26.1: source s, sink t. */
export const NETWORK = [
  { from: "s", to: "a", cap: 16 }, { from: "s", to: "b", cap: 13 }, { from: "a", to: "c", cap: 12 }, { from: "b", to: "a", cap: 4 },
  { from: "b", to: "d", cap: 14 }, { from: "c", to: "b", cap: 9 }, { from: "c", to: "t", cap: 20 }, { from: "d", to: "c", cap: 7 }, { from: "d", to: "t", cap: 4 },
];

/** Residual edges include reverse ones, so a later path can send flow back and reroute it. */
export function maxFlow(edges, s, t) {
  const on = Object.fromEntries(edges.map(e => [`${e.from}>${e.to}`, 0])), paths = [];
  const residual = () => edges.flatMap(e => [{ from: e.from, to: e.to, left: e.cap - on[`${e.from}>${e.to}`], key: `${e.from}>${e.to}`, dir: 1 },
    { from: e.to, to: e.from, left: on[`${e.from}>${e.to}`], key: `${e.from}>${e.to}`, dir: -1 }]).filter(r => r.left > 0);
  for (;;) {
    const res = residual(), prev = { [s]: null }, queue = [s];          // breadth-first: the shortest augmenting path
    while (queue.length && !(t in prev)) { const u = queue.shift(); for (const r of res) if (r.from === u && !(r.to in prev)) { prev[r.to] = r; queue.push(r.to); } }
    if (!(t in prev)) break;
    const path = []; for (let v = t; prev[v]; v = prev[v].from) path.unshift(prev[v]);
    const push = Math.min(...path.map(r => r.left));
    for (const r of path) on[r.key] += r.dir * push;
    paths.push({ nodes: [s, ...path.map(r => r.to)], push, on: { ...on } });
  }
  const flow = edges.filter(e => e.from === s).reduce((a, e) => a + on[`${e.from}>${e.to}`], 0) - edges.filter(e => e.to === s).reduce((a, e) => a + on[`${e.from}>${e.to}`], 0);
  return { flow, on, paths, cut: minCut(edges, s, on) };
}
/** The nodes still reachable from s in the residual network; edges leaving them form a minimum cut. */
function minCut(edges, s, on) {
  const seen = new Set([s]); let grew = true;
  while (grew) { grew = false; for (const e of edges) { const k = `${e.from}>${e.to}`;
    if (seen.has(e.from) && !seen.has(e.to) && on[k] < e.cap) { seen.add(e.to); grew = true; }
    if (seen.has(e.to) && !seen.has(e.from) && on[k] > 0) { seen.add(e.from); grew = true; } } }
  const edgesOut = edges.filter(e => seen.has(e.from) && !seen.has(e.to));
  return { side: [...seen], edges: edgesOut, capacity: edgesOut.reduce((a, e) => a + e.cap, 0) };
}
