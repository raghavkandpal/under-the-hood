// Grid pathfinding: BFS, Dijkstra, greedy best-first and A*, recorded step by step. No DOM.
// Cells: 0 = open, 1 = wall, 2..9 = terrain cost (e.g. mud = 5).

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, pri, tie) {
    const a = this.a; a.push({ item, pri, tie }); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.less(i, p)) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; }
  }
  less(i, j) { const a = this.a; return a[i].pri < a[j].pri || (a[i].pri === a[j].pri && a[i].tie < a[j].tie); }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && this.less(l, m)) m = l; if (r < a.length && this.less(r, m)) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top.item;
  }
}

export const ALGOS = {
  bfs: { label: "Breadth-first search", weighted: false },
  dijkstra: { label: "Dijkstra", weighted: true },
  greedy: { label: "Greedy best-first", weighted: true },
  astar: { label: "A*", weighted: true },
};

const cost = v => (v === 0 ? 1 : v);
export const manhattan = (a, b, w) => Math.abs(a % w - b % w) + Math.abs(Math.floor(a / w) - Math.floor(b / w));

/**
 * grid: flat array, width w. Returns { order: [cell indices in expansion order], frontierAt: [...sizes], path, pathCost }.
 */
export function search(grid, w, start, goal, algo) {
  const h = grid.length / w, N = grid.length;
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const order = [], frontier = [];
  const nbrs = i => { const x = i % w, y = (i / w) | 0, out = []; if (y > 0) out.push(i - w); if (x < w - 1) out.push(i + 1); if (y < h - 1) out.push(i + w); if (x > 0) out.push(i - 1); return out.filter(j => grid[j] !== 1); };
  const H = i => manhattan(i, goal, w);
  dist[start] = 0;
  let tie = 0;
  if (algo === "bfs") {
    const q = [start]; let qi = 0; closed[start] = 1;
    while (qi < q.length) {
      const u = q[qi++]; order.push(u); frontier.push(q.length - qi);
      if (u === goal) break;
      for (const v of nbrs(u)) if (!closed[v]) { closed[v] = 1; prev[v] = u; dist[v] = dist[u] + cost(grid[v]); q.push(v); }
    }
  } else {
    const pq = new Heap();
    pq.push(start, algo === "greedy" ? H(start) : algo === "astar" ? H(start) : 0, tie++);
    while (pq.size) {
      const u = pq.pop(); if (closed[u]) continue; closed[u] = 1; order.push(u); frontier.push(pq.size);
      if (u === goal) break;
      for (const v of nbrs(u)) {
        if (closed[v]) continue;
        const nd = dist[u] + cost(grid[v]);
        if (nd < dist[v]) {
          dist[v] = nd; prev[v] = u;
          const pri = algo === "dijkstra" ? nd : algo === "greedy" ? H(v) : nd + H(v);
          pq.push(v, pri, algo === "astar" ? -nd : tie++); // A*: break ties toward deeper nodes
        }
      }
    }
  }
  let path = [];
  if (prev[goal] !== -1 || start === goal) { for (let c = goal; c !== -1; c = prev[c]) path.push(c); path.reverse(); }
  const pathCost = path.slice(1).reduce((s, c) => s + cost(grid[c]), 0);
  return { order, frontier, path, pathCost: path.length ? pathCost : Infinity };
}

export function maze(w, h, seed = 1) {
  // randomised DFS maze on odd cells, then knock out some walls for loops
  let x = seed >>> 0; const r = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const g = new Array(w * h).fill(1);
  const stack = [[1, 1]]; g[w + 1] = 0;
  while (stack.length) {
    const [cx, cy] = stack.at(-1);
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && g[ny * w + nx] === 1; });
    if (!dirs.length) { stack.pop(); continue; }
    const [dx, dy] = dirs[Math.floor(r() * dirs.length)];
    g[(cy + dy / 2) * w + cx + dx / 2] = 0; g[(cy + dy) * w + cx + dx] = 0; stack.push([cx + dx, cy + dy]);
  }
  for (let i = 0; i < w * h / 12; i++) { const c = Math.floor(r() * w * h); const cx = c % w, cy = (c / w) | 0; if (cx > 0 && cy > 0 && cx < w - 1 && cy < h - 1) g[c] = 0; }
  return g;
}
