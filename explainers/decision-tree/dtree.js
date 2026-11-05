// CART decision tree for 2-D binary classification (labels ±1), Gini impurity. No DOM.

export const gini = (pos, n) => { if (!n) return 0; const p = pos / n; return 2 * p * (1 - p); };

export function bestSplit(pts) {
  const n = pts.length, totPos = pts.filter(p => p.y > 0).length;
  let best = null;
  for (const f of [0, 1]) {
    const s = pts.slice().sort((a, b) => a.x[f] - b.x[f]);
    let lp = 0;
    for (let i = 0; i < n - 1; i++) {
      if (s[i].y > 0) lp++;
      if (s[i].x[f] === s[i + 1].x[f]) continue;
      const ln = i + 1, rn = n - ln, rp = totPos - lp;
      const score = (ln * gini(lp, ln) + rn * gini(rp, rn)) / n;
      if (!best || score < best.score - 1e-12) best = { f, t: (s[i].x[f] + s[i + 1].x[f]) / 2, score, ln, rn };
    }
  }
  return best;
}

let nid = 0;
export function build(pts, { maxDepth = 3, minLeaf = 1 } = {}, depth = 0) {
  if (depth === 0) nid = 0;
  const n = pts.length, pos = pts.filter(p => p.y > 0).length;
  const node = { id: nid++, n, pos, depth, impurity: gini(pos, n), label: pos * 2 >= n ? 1 : -1 };
  if (depth >= maxDepth || node.impurity === 0 || n < 2 * minLeaf) return node;
  const s = bestSplit(pts);
  if (!s || s.ln < minLeaf || s.rn < minLeaf || s.score >= node.impurity - 1e-12) return node;
  node.f = s.f; node.t = s.t; node.gain = node.impurity - s.score;
  node.left = build(pts.filter(p => p.x[s.f] <= s.t), { maxDepth, minLeaf }, depth + 1);
  node.right = build(pts.filter(p => p.x[s.f] > s.t), { maxDepth, minLeaf }, depth + 1);
  return node;
}

export function predict(node, x) { while (node.left) node = x[node.f] <= node.t ? node.left : node.right; return node.label; }
export function leafOf(node, x) { while (node.left) node = x[node.f] <= node.t ? node.left : node.right; return node; }
export const accuracy = (tree, pts) => pts.filter(p => predict(tree, p.x) === p.y).length / pts.length;
export function nodes(tree) { const out = []; (function w(n) { out.push(n); if (n.left) { w(n.left); w(n.right); } })(tree); return out; }
