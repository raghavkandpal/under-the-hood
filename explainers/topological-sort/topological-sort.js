// Topological sort with Kahn's algorithm: an order for tasks where every task comes after the ones it needs. No DOM.

/** edges: [before, after]. Returns the order, each step's state for replaying, and the nodes stuck in a cycle (if any). */
export function kahn(nodes, edges) {
  const indeg = Object.fromEntries(nodes.map(n => [n, 0])), out = Object.fromEntries(nodes.map(n => [n, []]));
  for (const [a, b] of edges) { indeg[b]++; out[a].push(b); }
  const ready = nodes.filter(n => !indeg[n]), order = [], steps = [];
  while (ready.length) {
    ready.sort((a, b) => nodes.indexOf(a) - nodes.indexOf(b));
    const n = ready.shift(); order.push(n);
    for (const m of out[n]) if (!--indeg[m]) ready.push(m);
    steps.push({ pick: n, ready: [...ready], indeg: { ...indeg } });
  }
  return { order, steps, cycle: nodes.filter(n => !order.includes(n)) };
}

/** Every valid order, for small graphs: how much freedom the constraints leave. */
export function allOrders(nodes, edges, limit = 100000) {
  const res = []; let count = 0;
  (function go(done, left) {
    if (count >= limit) return;
    if (!left.length) { count++; if (res.length < 5) res.push([...done]); return; }
    for (const n of left) if (edges.every(([a, b]) => b !== n || done.includes(a))) go([...done, n], left.filter(x => x !== n));
  })([], nodes);
  return { count, examples: res };
}
export const valid = (order, edges) => edges.every(([a, b]) => order.indexOf(a) < order.indexOf(b));

/** A small made-up build. */
export const TASKS = ["fetch deps", "codegen", "compile lib", "compile app", "unit tests", "bundle", "docs", "e2e tests", "deploy"];
export const DEPS = [["fetch deps", "compile lib"], ["codegen", "compile lib"], ["compile lib", "compile app"], ["compile lib", "unit tests"],
  ["compile app", "bundle"], ["compile lib", "docs"], ["bundle", "e2e tests"], ["unit tests", "deploy"], ["e2e tests", "deploy"]];
