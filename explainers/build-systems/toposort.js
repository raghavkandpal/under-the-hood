// Dependency graphs: topological order (Kahn), parallel levels, critical path, incremental rebuilds, cycles. No DOM.
// deps: { target: [things it depends on] }, cost: { target: seconds }

export function nodesOf(deps) { const s = new Set(Object.keys(deps)); for (const d of Object.values(deps)) d.forEach(x => s.add(x)); return [...s]; }

/** Kahn's algorithm, grouped into "waves" that can run in parallel. Returns { order, waves } or { cycle }. */
export function topo(deps) {
  const nodes = nodesOf(deps), indeg = Object.fromEntries(nodes.map(n => [n, (deps[n] || []).length])), users = Object.fromEntries(nodes.map(n => [n, []]));
  for (const [t, ds] of Object.entries(deps)) for (const d of ds) users[d].push(t);
  let wave = nodes.filter(n => !indeg[n]).sort(); const waves = [], order = [];
  while (wave.length) { waves.push(wave); order.push(...wave); const next = []; for (const n of wave) for (const u of users[n]) if (--indeg[u] === 0) next.push(u); wave = next.sort(); }
  if (order.length < nodes.length) return { cycle: findCycle(deps) };
  return { order, waves };
}

function findCycle(deps) {
  const state = {}, stack = [];
  const dfs = n => { state[n] = 1; stack.push(n); for (const d of deps[n] || []) { if (state[d] === 1) return stack.slice(stack.indexOf(d)).concat(d); if (!state[d]) { const c = dfs(d); if (c) return c; } } stack.pop(); state[n] = 2; return null; };
  for (const n of nodesOf(deps)) if (!state[n]) { const c = dfs(n); if (c) return c; }
  return null;
}

/** Everything that must be rebuilt when `changed` changes: it and all (transitive) dependents. */
export function dirty(deps, changed) {
  const users = {}; for (const [t, ds] of Object.entries(deps)) for (const d of ds) (users[d] ||= []).push(t);
  const out = new Set(changed), q = [...changed];
  while (q.length) for (const u of users[q.shift()] || []) if (!out.has(u)) { out.add(u); q.push(u); }
  return out;
}

/** Earliest finish times with unlimited parallelism; the longest chain is the critical path. */
export function schedule(deps, cost, only = null) {
  const { order } = topo(deps), finish = {}, from = {};
  for (const n of order) {
    if (only && !only.has(n)) { finish[n] = 0; continue; }
    let start = 0; for (const d of deps[n] || []) if (finish[d] > start) { start = finish[d]; from[n] = d; }
    finish[n] = start + (cost[n] || 0);
  }
  let end = order.reduce((a, n) => (finish[n] > finish[a] ? n : a), order[0]); const total = finish[end], path = [];
  while (end) { path.unshift(end); end = from[end]; }
  const serial = order.filter(n => !only || only.has(n)).reduce((s, n) => s + (cost[n] || 0), 0);
  return { finish, total, path, serial };
}
