// Binary search trees with and without AVL rebalancing. Nodes are { key, left, right, h }. No DOM.

const h = n => (n ? n.h : 0);
const fix = n => ((n.h = 1 + Math.max(h(n.left), h(n.right))), n);
const rotR = n => { const l = n.left; n.left = l.right; l.right = fix(n); return fix(l); };
const rotL = n => { const r = n.right; n.right = r.left; r.left = fix(n); return fix(r); };

/** Insert `key`. With avl, rebalance on the way back up; `log` collects the rotations used ("LL", "RR", "LR", "RL"). */
export function insert(n, key, avl, log = []) {
  if (!n) return { key, left: null, right: null, h: 1 };
  if (key === n.key) return n;
  if (key < n.key) n.left = insert(n.left, key, avl, log); else n.right = insert(n.right, key, avl, log);
  fix(n);
  if (!avl) return n;
  const bal = h(n.left) - h(n.right);
  if (bal > 1) { if (key < n.left.key) { log.push("LL"); return rotR(n); } log.push("LR"); n.left = rotL(n.left); return rotR(n); }
  if (bal < -1) { if (key > n.right.key) { log.push("RR"); return rotL(n); } log.push("RL"); n.right = rotR(n.right); return rotL(n); }
  return n;
}
export function build(keys, avl) { let root = null; const log = []; for (const k of keys) root = insert(root, k, avl, log); return { root, rotations: log }; }

export const height = h;
export function inorder(n, out = []) { if (n) { inorder(n.left, out); out.push(n.key); inorder(n.right, out); } return out; }
/** Average number of nodes visited to find each key. */
export function avgDepth(root) { let s = 0, c = 0; (function go(n, d) { if (!n) return; s += d; c++; go(n.left, d + 1); go(n.right, d + 1); })(root, 1); return c ? s / c : 0; }
/** x by in-order position, y by depth, for drawing. */
export function layout(root) { const out = []; let i = 0; (function go(n, d, parent) { if (!n) return; go(n.left, d + 1, n); out.push({ key: n.key, x: i++, d, parent: parent?.key ?? null }); go(n.right, d + 1, n); })(root, 0, null); return out; }
