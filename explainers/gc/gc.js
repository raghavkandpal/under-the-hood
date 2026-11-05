// A toy heap with two collectors: reference counting and mark-and-sweep. No DOM.

export class Heap {
  constructor(mode = "marksweep") { this.mode = mode; this.objs = new Map(); this.roots = new Map(); this.next = 1; this.freed = []; }
  alloc(rootName = null) {
    const id = this.next++; this.objs.set(id, { id, refs: new Set(), rc: 0 });
    if (rootName) this.setRoot(rootName, id);
    return id;
  }
  setRoot(name, id) {
    const old = this.roots.get(name);
    if (id != null) { this.roots.set(name, id); this.inc(id); } else this.roots.delete(name);
    if (old != null) this.dec(old);
  }
  link(a, b) { const o = this.objs.get(a); if (!o || !this.objs.has(b) || o.refs.has(b)) return false; o.refs.add(b); this.inc(b); return true; }
  unlink(a, b) { const o = this.objs.get(a); if (!o || !o.refs.delete(b)) return false; this.dec(b); return true; }
  inc(id) { const o = this.objs.get(id); if (o) o.rc++; }
  dec(id) {
    const o = this.objs.get(id); if (!o) return;
    o.rc--;
    if (this.mode === "refcount" && o.rc === 0) this.free(id);
  }
  free(id) {
    const o = this.objs.get(id); if (!o) return;
    this.objs.delete(id); this.freed.push(id);
    for (const r of o.refs) this.dec(r);
  }
  reachable() {
    const seen = new Set(), order = [], stack = [...this.roots.values()];
    while (stack.length) { const id = stack.pop(); if (seen.has(id) || !this.objs.has(id)) continue; seen.add(id); order.push(id); for (const r of this.objs.get(id).refs) stack.push(r); }
    return { seen, order };
  }
  garbage() { const { seen } = this.reachable(); return [...this.objs.keys()].filter(id => !seen.has(id)); }
  /** Mark from the roots, then sweep everything unmarked. Returns the mark order and what was freed. */
  collect() {
    const { order } = this.reachable(), marked = new Set(order), swept = [];
    for (const id of [...this.objs.keys()]) if (!marked.has(id)) {
      const o = this.objs.get(id);
      this.objs.delete(id); this.freed.push(id); swept.push(id);
      for (const r of o.refs) { const t = this.objs.get(r); if (t) t.rc--; }
    }
    return { order, swept };
  }
}
