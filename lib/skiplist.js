// Skip list: a sorted linked list with random "express lanes" for O(log n) search. No DOM.
import { mulberry } from "./autograd.js";

export class SkipList {
  constructor({ p = 0.5, maxLevel = 8, seed = 1 } = {}) {
    Object.assign(this, { p, maxLevel }); this.r = mulberry(seed);
    this.head = { key: -Infinity, next: new Array(maxLevel).fill(null) }; this.level = 1; this.size = 0;
  }
  randomLevel() { let l = 1; while (l < this.maxLevel && this.r() < this.p) l++; return l; }
  /** Returns the search path: [{key, level}] of every node visited. */
  search(key) {
    const path = []; let x = this.head;
    for (let i = this.level - 1; i >= 0; i--) {
      while (x.next[i] && x.next[i].key < key) { x = x.next[i]; path.push({ key: x.key, level: i }); }
      path.push({ key: x.key, level: i, drop: true });
    }
    const n = x.next[0];
    return { found: !!n && n.key === key, path, steps: path.length };
  }
  insert(key) {
    const update = new Array(this.maxLevel); let x = this.head;
    for (let i = this.level - 1; i >= 0; i--) { while (x.next[i] && x.next[i].key < key) x = x.next[i]; update[i] = x; }
    if (x.next[0] && x.next[0].key === key) return false;
    const lvl = this.randomLevel();
    if (lvl > this.level) { for (let i = this.level; i < lvl; i++) update[i] = this.head; this.level = lvl; }
    const node = { key, next: new Array(lvl).fill(null) };
    for (let i = 0; i < lvl; i++) { node.next[i] = update[i].next[i]; update[i].next[i] = node; }
    this.size++; return true;
  }
  remove(key) {
    const update = new Array(this.maxLevel); let x = this.head;
    for (let i = this.level - 1; i >= 0; i--) { while (x.next[i] && x.next[i].key < key) x = x.next[i]; update[i] = x; }
    const n = x.next[0]; if (!n || n.key !== key) return false;
    for (let i = 0; i < n.next.length; i++) update[i].next[i] = n.next[i];
    while (this.level > 1 && !this.head.next[this.level - 1]) this.level--;
    this.size--; return true;
  }
  /** Nodes in order with their heights. */
  nodes() { const out = []; for (let x = this.head.next[0]; x; x = x.next[0]) out.push({ key: x.key, height: x.next.length }); return out; }
}
