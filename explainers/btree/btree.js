// A B-tree (insert + search) with configurable max keys per node, recording what each operation touched. No DOM.

let nid = 0;
const node = (leaf = true) => ({ id: nid++, keys: [], kids: [], leaf });

export class BTree {
  /** maxKeys: most keys a node may hold (>= 2). A full node splits on the way down. */
  constructor(maxKeys = 3) { this.max = maxKeys; this.root = node(); this.size = 0; }

  search(k) {
    const visited = []; let n = this.root;
    for (;;) {
      visited.push(n.id);
      let i = 0; while (i < n.keys.length && k > n.keys[i]) i++;
      if (i < n.keys.length && n.keys[i] === k) return { found: true, visited };
      if (n.leaf) return { found: false, visited };
      n = n.kids[i];
    }
  }

  insert(k) {
    if (this.search(k).found) return { inserted: false, splits: [] };
    const splits = [];
    // split the child at index i of parent p (child is overfull: max+1 keys)
    const split = (p, i) => {
      const c = p.kids[i], mid = Math.floor(c.keys.length / 2), right = node(c.leaf);
      right.keys = c.keys.splice(mid + 1); const up = c.keys.pop();
      if (!c.leaf) right.kids = c.kids.splice(mid + 1);
      p.keys.splice(i, 0, up); p.kids.splice(i + 1, 0, right);
      splits.push({ left: c.id, right: right.id, up });
    };
    const ins = n => {
      let i = 0; while (i < n.keys.length && k > n.keys[i]) i++;
      if (n.leaf) n.keys.splice(i, 0, k);
      else { ins(n.kids[i]); if (n.kids[i].keys.length > this.max) split(n, i); }
    };
    ins(this.root);
    if (this.root.keys.length > this.max) { const r = node(false); r.kids = [this.root]; this.root = r; split(r, 0); }
    this.size++;
    return { inserted: true, splits };
  }

  height() { let h = 1, n = this.root; while (!n.leaf) { n = n.kids[0]; h++; } return h; }
  levels() { const out = []; let cur = [this.root]; while (cur.length) { out.push(cur); cur = cur.flatMap(n => n.kids); } return out; }
  inorder() { const out = []; (function w(n) { n.keys.forEach((k, i) => { if (!n.leaf) w(n.kids[i]); out.push(k); }); if (!n.leaf) w(n.kids.at(-1)); })(this.root); return out; }
  check() {
    // invariants: sorted, key counts within bounds, all leaves at the same depth
    const depths = new Set(), min = Math.ceil((this.max + 1) / 2) - 1;
    const walk = (n, d, lo, hi, isRoot) => {
      if (n.keys.length > this.max || (!isRoot && n.keys.length < min)) throw new Error(`node ${n.id} has ${n.keys.length} keys`);
      n.keys.forEach((k, i) => { if (k <= lo || k >= hi || (i && k <= n.keys[i - 1])) throw new Error("order"); });
      if (n.leaf) depths.add(d); else { if (n.kids.length !== n.keys.length + 1) throw new Error("kids"); n.kids.forEach((c, i) => walk(c, d + 1, i ? n.keys[i - 1] : lo, i < n.keys.length ? n.keys[i] : hi, false)); }
    };
    walk(this.root, 0, -Infinity, Infinity, true);
    if (depths.size > 1) throw new Error("unbalanced");
    return true;
  }
}
