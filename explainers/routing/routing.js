// Distance-vector routing (RIP-style Bellman-Ford) with count-to-infinity and split horizon; Dijkstra for comparison. No DOM.
// links: [[a, b, cost]], undirected. tables: { node: { dest: { cost, via } } }

export const INF = 16; // RIP's "infinity": 16 hops means unreachable

export function neighbours(links) {
  const nb = {}; for (const [a, b, c] of links) { (nb[a] ||= {})[b] = c; (nb[b] ||= {})[a] = c; } return nb;
}

/** Each router starts knowing only itself. */
export function init(nodes) { return Object.fromEntries(nodes.map(n => [n, { [n]: { cost: 0, via: n } }])); }

/** What `from` tells neighbour `to`. With split horizon + poisoned reverse, routes learned via `to` are advertised as INF. */
export function advert(table, to, { splitHorizon = false } = {}) {
  const out = {}; for (const [d, r] of Object.entries(table)) out[d] = splitHorizon && r.via === to && d !== to ? INF : r.cost; return out;
}

/** One synchronous round: every router hears every neighbour's vector, then recomputes. */
export function step(tables, links, opts = {}) {
  const nb = neighbours(links), nodes = Object.keys(tables), next = {};
  let changed = false;
  for (const n of nodes) {
    const t = { [n]: { cost: 0, via: n } }, dests = new Set(nodes);
    for (const d of dests) {
      if (d === n) continue;
      let best = { cost: INF, via: null };
      for (const [m, c] of Object.entries(nb[n] || {})) {
        const v = advert(tables[m], n, opts)[d]; if (v == null) continue;
        const cost = Math.min(INF, c + v);
        if (cost < best.cost || (cost === best.cost && best.via != null && m < best.via)) best = { cost, via: m };
      }
      const old = tables[n][d];
      if (best.cost < INF || old) t[d] = best.cost < INF ? best : { cost: INF, via: null };
      const o = old || { cost: INF, via: null };
      if (o.cost !== t[d]?.cost || o.via !== t[d]?.via) if (t[d] || old) changed = true;
    }
    next[n] = t;
  }
  return { tables: next, changed };
}

/** Run until nothing changes (or a cap). */
export function converge(tables, links, opts = {}, cap = 60) {
  let rounds = 0, t = tables;
  for (; rounds < cap; rounds++) { const r = step(t, links, opts); if (!r.changed) break; t = r.tables; }
  return { tables: t, rounds };
}

/** Link-state alternative: every router knows the whole map and runs Dijkstra. */
export function dijkstra(links, src) {
  const nb = neighbours(links), dist = { [src]: 0 }, done = new Set();
  for (;;) {
    let u = null; for (const [n, d] of Object.entries(dist)) if (!done.has(n) && (u == null || d < dist[u])) u = n;
    if (u == null) return dist; done.add(u);
    for (const [v, c] of Object.entries(nb[u] || {})) if (dist[u] + c < (dist[v] ?? Infinity)) dist[v] = dist[u] + c;
  }
}
