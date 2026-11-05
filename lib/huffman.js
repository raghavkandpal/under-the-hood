// Pure Huffman logic, no DOM. Deterministic tie-breaking so steps are reproducible.

export function frequencies(text) {
  const m = new Map();
  for (const ch of text) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}

let nextId = 0;
const leaf = (sym, weight) => ({ id: nextId++, sym, weight, order: sym.codePointAt(0) });
const join = (a, b) => ({ id: nextId++, weight: a.weight + b.weight, left: a, right: b, order: Math.min(a.order, b.order) });

// Order by weight, then leaves-before-internal-by-age, then symbol order: stable and predictable.
function cmp(a, b) {
  return a.weight - b.weight || a.id - b.id;
}

/**
 * Returns every intermediate state of the forest. snapshots[0] is all leaves,
 * the last has a single root. Each step records which two nodes were merged.
 */
export function buildSteps(text) {
  nextId = 0;
  const freq = frequencies(text);
  const leaves = [...freq.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].codePointAt(0) - b[0].codePointAt(0))
    .map(([s, w]) => leaf(s, w));
  let forest = leaves.slice().sort(cmp);
  const steps = [{ forest: forest.slice(), merged: null }];
  while (forest.length > 1) {
    const [a, b, ...rest] = forest;
    const n = join(a, b);
    forest = [...rest, n].sort(cmp);
    steps.push({ forest: forest.slice(), merged: { a, b, node: n } });
  }
  return steps;
}

export function codesFrom(root) {
  const codes = new Map();
  if (!root) return codes;
  if (root.sym != null) { codes.set(root.sym, "0"); return codes; } // single-symbol edge case
  (function walk(n, path) {
    if (n.sym != null) { codes.set(n.sym, path); return; }
    walk(n.left, path + "0");
    walk(n.right, path + "1");
  })(root, "");
  return codes;
}

export function encode(text, codes) {
  let out = "";
  for (const ch of text) out += codes.get(ch);
  return out;
}

export function decode(bits, root) {
  if (!root) return "";
  if (root.sym != null) return root.sym.repeat(bits.length);
  let out = "", n = root;
  for (const b of bits) {
    n = b === "0" ? n.left : n.right;
    if (n.sym != null) { out += n.sym; n = root; }
  }
  return out;
}

export function entropyBits(text) {
  const freq = frequencies(text);
  const total = [...text].length;
  let h = 0;
  for (const c of freq.values()) { const p = c / total; h -= p * Math.log2(p); }
  return h;
}
