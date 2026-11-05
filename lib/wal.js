// Write-ahead logging and crash recovery (a tiny ARIES: redo everything logged, then undo the losers). No DOM.
// Memory (lost on crash): page cache + log buffer. Disk (survives): data pages + the flushed log.

export class Engine {
  constructor(initial, { wal = true } = {}) {
    this.wal = wal; this.disk = { ...initial }; this.cache = {}; this.dirty = new Set();
    this.logBuf = []; this.logDisk = []; this.lsn = 0; this.active = new Set(); this.events = [];
  }
  read(k) { return k in this.cache ? this.cache[k] : this.disk[k]; }
  begin(tx) { this.active.add(tx); this.#log({ tx, type: "begin" }); }
  write(tx, k, v) {
    if (!this.active.has(tx)) this.begin(tx);
    this.#log({ tx, type: "update", key: k, old: this.read(k), new: v });
    this.cache[k] = v; this.dirty.add(k);
  }
  /** Commit. With WAL: append a commit record and fsync the log (the only thing that must hit disk). Without: write every dirty page in place, one by one. */
  commit(tx, { crashAfterPages = Infinity } = {}) {
    this.#log({ tx, type: "commit" });
    if (this.wal) { this.flushLog(); this.active.delete(tx); this.events.push(`T${tx} committed: log flushed, pages can wait`); return true; }
    let n = 0;
    for (const k of [...this.dirty]) { if (n++ >= crashAfterPages) { this.crash(); return false; } this.disk[k] = this.cache[k]; this.dirty.delete(k); }
    this.active.delete(tx); this.events.push(`T${tx} committed: pages written in place`); return true;
  }
  flushLog() { this.logDisk.push(...this.logBuf); this.logBuf = []; }
  /** Write one dirty page to disk. The WAL rule: its log records must reach disk first. */
  flushPage(k) {
    if (!this.dirty.has(k)) return;
    if (this.wal) this.flushLog();
    this.disk[k] = this.cache[k]; this.dirty.delete(k); this.events.push(`page ${k} written to disk`);
  }
  crash() { this.cache = {}; this.dirty.clear(); this.logBuf = []; this.active.clear(); this.events.push("💥 crash: memory lost"); }
  /** Redo all logged updates in order, then undo those of transactions that never committed. Returns a report. */
  recover() {
    if (!this.wal) { this.events.push("restart: no log, so nothing to repair"); return { redone: 0, undone: 0, losers: [] }; }
    const committed = new Set(this.logDisk.filter(r => r.type === "commit").map(r => r.tx));
    let redone = 0, undone = 0;
    for (const r of this.logDisk) if (r.type === "update") { this.disk[r.key] = r.new; redone++; }
    const losers = [...new Set(this.logDisk.filter(r => !committed.has(r.tx)).map(r => r.tx))];
    for (const r of [...this.logDisk].reverse()) if (r.type === "update" && !committed.has(r.tx)) { this.disk[r.key] = r.old; undone++; }
    for (const tx of losers) this.logDisk.push({ lsn: ++this.lsn, tx, type: "abort" });
    this.events.push(`recovery: redid ${redone}, undid ${undone}`); return { redone, undone, losers };
  }
  #log(r) { this.logBuf.push({ lsn: ++this.lsn, ...r }); }
}

/** Check a bank transfer: was money created or destroyed? */
export const total = (db, keys) => keys.reduce((s, k) => s + db[k], 0);
