// Merkle trees: build, prove inclusion, verify, and diff two trees. Uses SHA-1 from lib/git.js (sync). No DOM.
import { sha1 } from "./git.js";

const enc = new TextEncoder();
export const H = s => sha1(enc.encode(s));
// Domain-separate leaves and internal nodes so a leaf can't masquerade as a node.
export const leafHash = data => H("leaf:" + data);
export const nodeHash = (l, r) => H("node:" + l + r);

/** levels[0] = leaf hashes, last level = [root]. An odd node out is promoted unchanged. */
export function build(blocks) {
  const levels = [blocks.map(leafHash)];
  while (levels.at(-1).length > 1) {
    const cur = levels.at(-1), next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? nodeHash(cur[i], cur[i + 1]) : cur[i]);
    levels.push(next);
  }
  return { levels, root: levels.at(-1)[0] ?? H("empty") };
}

/** Sibling path for leaf i: [{hash, side: "L"|"R", level}] */
export function proof(tree, i) {
  const out = [];
  for (let l = 0; l < tree.levels.length - 1; l++) {
    const lv = tree.levels[l], sib = i ^ 1;
    if (sib < lv.length) out.push({ hash: lv[sib], side: sib < i ? "L" : "R", level: l, index: sib });
    i >>= 1;
  }
  return out;
}

export function verify(data, path, root) {
  let h = leafHash(data);
  for (const p of path) h = p.side === "L" ? nodeHash(p.hash, h) : nodeHash(h, p.hash);
  return h === root;
}

/** Walk two same-shape trees from the root, descending only into subtrees whose hashes differ. */
export function diff(a, b) {
  const top = a.levels.length - 1, visited = [], leaves = [];
  if (a.levels.length !== b.levels.length) return { visited, leaves: null };
  (function walk(l, i) {
    visited.push({ l, i });
    if (a.levels[l][i] === b.levels[l][i]) return;
    if (l === 0) { leaves.push(i); return; }
    for (const c of [2 * i, 2 * i + 1]) if (c < a.levels[l - 1].length) {
      // promoted odd node: same hash as its single child, still descend
      walk(l - 1, c);
    }
  })(top, 0);
  return { visited, leaves };
}
