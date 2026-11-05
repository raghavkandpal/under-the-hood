// A log-structured merge tree: memtable, immutable sorted runs (SSTables), tombstones and compaction. No DOM.

export const TOMB = null; // a delete is a write of "nothing"

export class LSM {
  constructor({ memLimit = 4, compactAt = 4 } = {}) {
    Object.assign(this, { memLimit, compactAt });
    this.mem = new Map(); this.tables = []; // newest first; each {id, rows: [[k, v]] sorted}
    this.nextId = 1; this.stats = { userWrites: 0, diskWrites: 0, flushes: 0, compactions: 0 };
    this.events = [];
  }
  put(k, v) { this.mem.set(k, v); this.stats.userWrites++; if (this.mem.size >= this.memLimit) this.flush(); }
  del(k) { this.put(k, TOMB); }
  flush() {
    if (!this.mem.size) return;
    const rows = [...this.mem].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const t = { id: this.nextId++, rows }; this.tables.unshift(t); this.mem = new Map();
    this.stats.diskWrites += rows.length; this.stats.flushes++;
    this.events.push({ kind: "flush", id: t.id, n: rows.length });
    if (this.tables.length >= this.compactAt) this.compact();
  }
  /** Merge every table into one: newest value per key wins, tombstones dropped (this is the only/bottom level). */
  compact() {
    if (this.tables.length < 2) return;
    const merged = new Map();
    for (let i = this.tables.length - 1; i >= 0; i--) for (const [k, v] of this.tables[i].rows) merged.set(k, v);
    const before = this.tables.reduce((s, t) => s + t.rows.length, 0);
    const rows = [...merged].filter(([, v]) => v !== TOMB).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const t = { id: this.nextId++, rows, compacted: true };
    this.events.push({ kind: "compact", from: this.tables.map(x => x.id), id: t.id, before, after: rows.length });
    this.tables = [t]; this.stats.diskWrites += rows.length; this.stats.compactions++;
  }
  /** Look up newest-first; report every place checked. */
  get(k) {
    const checked = ["memtable"];
    if (this.mem.has(k)) { const v = this.mem.get(k); return { value: v === TOMB ? undefined : v, deleted: v === TOMB, checked, foundIn: "memtable" }; }
    for (const t of this.tables) {
      checked.push(t.id);
      const row = bsearch(t.rows, k);
      if (row) return { value: row[1] === TOMB ? undefined : row[1], deleted: row[1] === TOMB, checked, foundIn: t.id };
    }
    return { value: undefined, deleted: false, checked, foundIn: null };
  }
  get writeAmp() { return this.stats.userWrites ? this.stats.diskWrites / this.stats.userWrites : 0; }
}
function bsearch(rows, k) { let lo = 0, hi = rows.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (rows[m][0] === k) return rows[m]; if (rows[m][0] < k) lo = m + 1; else hi = m - 1; } return null; }
