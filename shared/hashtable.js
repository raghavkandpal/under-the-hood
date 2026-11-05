// Hash table with two collision strategies, instrumented to report every slot it touches. No DOM.

export const HASHES = {
  fnv1a: { label: "FNV-1a (good)", fn: s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; } },
  sum: { label: "sum of char codes (weak)", fn: s => { let h = 0; for (const c of s) h += c.codePointAt(0); return h; } },
  first: { label: "first letter only (terrible)", fn: s => s.length ? s.codePointAt(0) : 0 },
};

export const TOMBSTONE = Symbol("tombstone");

export class HashTable {
  constructor({ strategy = "chaining", capacity = 8, hash = "fnv1a", maxLoad = 0.75, autoResize = true } = {}) {
    Object.assign(this, { strategy, hash, maxLoad, autoResize });
    this.reset(capacity);
  }
  reset(capacity) {
    this.capacity = capacity; this.size = 0; this.tombstones = 0;
    this.slots = this.strategy === "chaining" ? Array.from({ length: capacity }, () => []) : new Array(capacity).fill(null);
  }
  h(key) { return HASHES[this.hash].fn(key); }
  home(key) { return this.h(key) % this.capacity; }
  load() { return this.size / this.capacity; }
  entries() {
    if (this.strategy === "chaining") return this.slots.flat();
    return this.slots.filter(s => s && s !== TOMBSTONE);
  }

  // Returns { probes: [{slot, pos?}], found, index }
  find(key) {
    const start = this.home(key), probes = [];
    if (this.strategy === "chaining") {
      const chain = this.slots[start];
      for (let i = 0; i < chain.length; i++) { probes.push({ slot: start, pos: i }); if (chain[i].key === key) return { probes, found: true, index: start, pos: i }; }
      if (!chain.length) probes.push({ slot: start, pos: -1 });
      return { probes, found: false, index: start };
    }
    let firstTomb = -1;
    for (let i = 0; i < this.capacity; i++) {
      const idx = (start + i) % this.capacity, s = this.slots[idx];
      probes.push({ slot: idx });
      if (s === null) return { probes, found: false, index: firstTomb >= 0 ? firstTomb : idx };
      if (s === TOMBSTONE) { if (firstTomb < 0) firstTomb = idx; continue; }
      if (s.key === key) return { probes, found: true, index: idx };
    }
    return { probes, found: false, index: firstTomb };
  }

  set(key, value) {
    const r = this.find(key);
    let resized = null;
    if (r.found) {
      if (this.strategy === "chaining") this.slots[r.index][r.pos].value = value; else this.slots[r.index].value = value;
      return { ...r, op: "update", resized };
    }
    if (this.strategy === "chaining") this.slots[r.index].push({ key, value });
    else {
      if (r.index < 0) throw new Error("table full"); // only possible with autoResize off and 100% load
      if (this.slots[r.index] === TOMBSTONE) this.tombstones--;
      this.slots[r.index] = { key, value };
    }
    this.size++;
    const pressure = (this.size + this.tombstones) / this.capacity;
    if (this.autoResize && pressure > this.maxLoad) {
      const before = { capacity: this.capacity, slots: this.strategy === "chaining" ? this.slots.map(c => c.slice()) : this.slots.slice() };
      resized = { ...this.resize(this.capacity * 2), before };
    }
    return { ...r, op: "insert", resized };
  }

  delete(key) {
    const r = this.find(key);
    if (!r.found) return { ...r, op: "delete" };
    if (this.strategy === "chaining") this.slots[r.index].splice(r.pos, 1);
    else { this.slots[r.index] = TOMBSTONE; this.tombstones++; }
    this.size--;
    return { ...r, op: "delete" };
  }

  resize(capacity) {
    const old = this.entries(), from = this.capacity;
    this.reset(capacity);
    let moves = 0;
    for (const { key, value } of old) { this.set(key, value); moves++; }
    return { from, to: capacity, moves };
  }

  stats() {
    const keys = this.entries().map(e => e.key);
    const probesFor = keys.map(k => this.find(k).probes.length);
    const avg = probesFor.length ? probesFor.reduce((a, b) => a + b, 0) / probesFor.length : 0;
    let worst = 0;
    if (this.strategy === "chaining") worst = Math.max(0, ...this.slots.map(c => c.length));
    else { let run = 0; for (let i = 0; i < this.capacity * 2; i++) { const s = this.slots[i % this.capacity]; run = s ? run + 1 : 0; worst = Math.max(worst, Math.min(run, this.capacity)); } }
    const used = this.strategy === "chaining" ? this.slots.filter(c => c.length).length : this.size;
    return { size: this.size, capacity: this.capacity, load: this.load(), avgProbes: avg, worst, usedSlots: used, tombstones: this.tombstones };
  }
}
