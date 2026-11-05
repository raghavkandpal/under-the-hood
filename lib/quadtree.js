// Spatial indexes: a point quadtree vs a uniform grid vs checking everything. No DOM.
// Coordinates are in [0, 1). Rectangles are { x, y, w, h }.

const inside = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class QuadTree {
  constructor(bounds = { x: 0, y: 0, w: 1, h: 1 }, cap = 4, depth = 0, maxDepth = 12) { Object.assign(this, { bounds, cap, depth, maxDepth, points: [], kids: null }); }
  insert(p) {
    if (!inside(p, this.bounds)) return false;
    if (!this.kids) {
      if (this.points.length < this.cap || this.depth >= this.maxDepth) { this.points.push(p); return true; }
      this.split();
    }
    return this.kids.some(k => k.insert(p));
  }
  split() {
    const { x, y, w, h } = this.bounds, hw = w / 2, hh = h / 2;
    this.kids = [[x, y], [x + hw, y], [x, y + hh], [x + hw, y + hh]].map(([a, b]) => new QuadTree({ x: a, y: b, w: hw, h: hh }, this.cap, this.depth + 1, this.maxDepth));
    for (const p of this.points) this.kids.some(k => k.insert(p));
    this.points = [];
  }
  /** Points inside rect, plus how much work it took. */
  query(rect, out = { points: [], visited: [], checked: 0 }) {
    if (!overlaps(rect, this.bounds)) return out;
    out.visited.push(this.bounds);
    if (!this.kids) { for (const p of this.points) { out.checked++; if (inside(p, rect)) out.points.push(p); } return out; }
    for (const k of this.kids) k.query(rect, out);
    return out;
  }
  /** All node rectangles (for drawing) and the depth reached. */
  nodes(list = []) { list.push({ ...this.bounds, depth: this.depth, leaf: !this.kids }); if (this.kids) this.kids.forEach(k => k.nodes(list)); return list; }
}

export function buildTree(points, cap = 4) { const t = new QuadTree(undefined, cap); points.forEach(p => t.insert(p)); return t; }

/** Uniform grid of n×n cells: simple, but crowded cells stay crowded. */
export function gridQuery(points, rect, n = 8) {
  const cells = Array.from({ length: n * n }, () => []);
  for (const p of points) cells[Math.min(n - 1, Math.floor(p.y * n)) * n + Math.min(n - 1, Math.floor(p.x * n))].push(p);
  const out = { points: [], checked: 0, cells: 0 };
  for (let cy = 0; cy < n; cy++) for (let cx = 0; cx < n; cx++) {
    if (!overlaps(rect, { x: cx / n, y: cy / n, w: 1 / n, h: 1 / n })) continue;
    out.cells++; for (const p of cells[cy * n + cx]) { out.checked++; if (inside(p, rect)) out.points.push(p); }
  }
  return { ...out, maxCell: Math.max(...cells.map(c => c.length)) };
}

export const scan = (points, rect) => ({ points: points.filter(p => inside(p, rect)), checked: points.length });

/** Test data: uniform, or clustered like people in cities. */
export function makePoints(n, kind, rnd) {
  const g = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  if (kind === "uniform") return Array.from({ length: n }, () => ({ x: rnd(), y: rnd() }));
  const centres = Array.from({ length: 6 }, () => ({ x: 0.1 + rnd() * 0.8, y: 0.1 + rnd() * 0.8, s: 0.01 + rnd() * 0.05 }));
  return Array.from({ length: n }, () => { const c = centres[Math.floor(rnd() ** 1.6 * centres.length)]; return { x: Math.min(0.999, Math.max(0, c.x + g() * c.s)), y: Math.min(0.999, Math.max(0, c.y + g() * c.s)) }; });
}
