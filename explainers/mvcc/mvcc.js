// MVCC: writers add row versions instead of overwriting, and each transaction reads from a snapshot. One row. No DOM.
// A version is { value, xmin (transaction that created it), xmax (transaction that replaced it, or null) }.

export function init(value = 100) { return { next: 2, versions: [{ value, xmin: 1, xmax: null }], status: { 1: "committed" }, txs: {} }; }
const clone = db => structuredClone(db);

/** A snapshot remembers which transactions had committed when it was taken. */
export function begin(db, name) {
  db = clone(db); const id = db.next++;
  db.status[id] = "active";
  db.txs[name] = { id, snap: Object.keys(db.status).filter(t => db.status[t] === "committed").map(Number) };
  return db;
}
/** Visible: created by a transaction in my snapshot (or by me), and not replaced by one. */
export function visible(db, v, name) {
  const t = db.txs[name], seen = x => x === t.id || t.snap.includes(x);
  return seen(v.xmin) && !(v.xmax !== null && seen(v.xmax));
}
export const read = (db, name) => db.versions.find(v => visible(db, v, name))?.value;

/** Update: mark my visible version replaced and add a new one. If someone else already replaced it, that's a conflict. */
export function write(db, name, value) {
  const t = db.txs[name], i = db.versions.findIndex(x => visible(db, x, name)), v = db.versions[i];
  if (v.xmax !== null && v.xmax !== t.id) return { db, error: `could not serialize: transaction ${v.xmax} already changed this row` };
  db = clone(db); const w = db.versions[i];
  if (w.xmin === t.id) w.value = value; else { w.xmax = t.id; db.versions.push({ value, xmin: t.id, xmax: null }); }
  return { db };
}
export function end(db, name, outcome) {
  db = clone(db); const t = db.txs[name]; db.status[t.id] = outcome;
  if (outcome === "aborted") for (const v of db.versions) if (v.xmax === t.id) v.xmax = null;
  delete db.txs[name]; return db;
}
/** Vacuum: drop versions no current or future transaction can see. */
export function vacuum(db) {
  db = clone(db);
  const dead = v => db.status[v.xmin] === "aborted" || (v.xmax !== null && db.status[v.xmax] === "committed" && Object.values(db.txs).every(t => t.snap.includes(v.xmax)));
  const before = db.versions.length; db.versions = db.versions.filter(v => !dead(v));
  return { db, removed: before - db.versions.length };
}
