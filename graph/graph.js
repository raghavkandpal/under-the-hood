// DOM-free layout for the full-page knowledge graph: a seeded force simulation. Prerequisite links pull explainers together,
// everything pushes apart, and each area is drawn toward its own spot so areas read as clusters.
// Fed from catalog.js, so a new explainer appears on the graph with no edit here.
import { mulberry } from "../shared/random.js";

const REPEL = 2600, LINK = 55, SPRING = 0.04, ANCHOR = 0.012, RING = 360, STEPS = 320;

export function layout(catalog, areas) {
  const known = new Set(catalog.map(c => c.id));
  const rnd = mulberry(15);
  const centre = new Map(areas.map((a, i) => [a.id, [RING * Math.cos(2 * Math.PI * i / areas.length), RING * Math.sin(2 * Math.PI * i / areas.length)]]));
  const nodes = catalog.map(c => { const [cx, cy] = centre.get(c.area) ?? [0, 0]; return { id: c.id, title: c.title, area: c.area, x: cx + (rnd() - 0.5) * 160, y: cy + (rnd() - 0.5) * 160, vx: 0, vy: 0 }; });
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = catalog.flatMap(c => c.prereqs.filter(p => known.has(p)).map(p => ({ from: p, to: c.id })));
  const pairs = edges.map(e => [nodes[index.get(e.from)], nodes[index.get(e.to)]]);

  for (let s = 0; s < STEPS; s++) {
    const alpha = 1 - s / STEPS;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 1; }
      const f = REPEL * alpha / d2, d = Math.sqrt(d2);
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const [a, b] of pairs) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - LINK) * SPRING;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const n of nodes) {
      const [cx, cy] = centre.get(n.area) ?? [0, 0];
      n.vx += (cx - n.x) * ANCHOR; n.vy += (cy - n.y) * ANCHOR;
      n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
      n.vx *= 0.55; n.vy *= 0.55;
    }
  }
  const minX = Math.min(...nodes.map(n => n.x)), minY = Math.min(...nodes.map(n => n.y));
  for (const n of nodes) { n.x -= minX; n.y -= minY; delete n.vx; delete n.vy; }
  return { nodes, edges, width: Math.max(...nodes.map(n => n.x)), height: Math.max(...nodes.map(n => n.y)) };
}
