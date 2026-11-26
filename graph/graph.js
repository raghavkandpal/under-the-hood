// DOM-free layout for the full-page knowledge graph: one column per prerequisite depth, grouped by area inside a column.
// Fed from catalog.js, so a new explainer appears on the graph with no edit here.
export const COLW = 220, ROWH = 34, NW = 170, NH = 26;

export function layout(catalog, areas) {
  const known = new Map(catalog.map(c => [c.id, c]));
  const prereqs = c => c.prereqs.filter(p => known.has(p));
  const depth = new Map();
  const D = id => {
    if (!depth.has(id)) { depth.set(id, 0); const ps = prereqs(known.get(id)); depth.set(id, ps.length ? 1 + Math.max(...ps.map(D)) : 0); } // the 0 first stops a cycle
    return depth.get(id);
  };
  const order = new Map(areas.map((a, i) => [a.id, i]));
  const sorted = [...catalog].sort((a, b) => D(a.id) - D(b.id) || order.get(a.area) - order.get(b.area) || a.title.localeCompare(b.title));
  const rows = new Map();
  const nodes = sorted.map(c => {
    const d = D(c.id), row = rows.get(d) ?? 0; rows.set(d, row + 1);
    return { id: c.id, title: c.title, area: c.area, depth: d, x: d * COLW, y: row * ROWH };
  });
  const edges = catalog.flatMap(c => prereqs(c).map(p => ({ from: p, to: c.id })));
  return { nodes, edges, width: (Math.max(0, ...depth.values()) + 1) * COLW, height: Math.max(0, ...rows.values()) * ROWH };
}
