// Backups and point-in-time recovery: a nightly base backup plus a WAL archive shipped in segments.
// No DOM. Times are minutes since 00:00 of the day; negative is the day before.

export const START = { accounts: { Alice: 100, Bob: 50 }, audit: [] };
export const BACKUP_AT = 0;   // the nightly base backup ends at 00:00
export const SEGMENT = 15;    // the archive ships a WAL segment every 15 minutes (model constant)
export const DROP_AT = 17 * 60 + 15;

const tx = (h, m, from, to, amount) => ({ t: h * 60 + m, kind: "transfer", from, to, amount });
export const LOG = [
  tx(8, 5, "Alice", "Bob", 20), tx(9, 30, "Bob", "Alice", 10), tx(11, 0, "Alice", "Bob", 40),
  tx(12, 15, "Bob", "Alice", 25), tx(13, 40, "Alice", "Bob", 15), tx(15, 10, "Bob", "Alice", 30),
  tx(16, 20, "Alice", "Bob", 50), tx(17, 5, "Bob", "Alice", 5), tx(17, 14, "Alice", "Bob", 10),
  { t: DROP_AT, kind: "drop" },
  tx(17, 25, "Alice", "Bob", 5), tx(20, 0, "Bob", "Alice", 45),
];

export const hhmm = t => {
  const m = ((t % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}${t < 0 ? " the day before" : ""}`;
};
const text = e => e.kind === "drop" ? "DROP TABLE audit" : `${e.from} → ${e.to} ${e.amount}`;

function apply(s, e) {
  if (e.kind === "drop") return { ...s, audit: null };
  const accounts = { ...s.accounts, [e.from]: s.accounts[e.from] - e.amount, [e.to]: s.accounts[e.to] + e.amount };
  return { accounts, audit: s.audit && [...s.audit, `${hhmm(e.t)} ${text(e)}`] };
}
const replay = (s, from, to) => LOG.filter(e => e.t > from && e.t <= to).reduce(apply, s);

/** The live database at minute t. */
export const stateAt = t => replay(START, BACKUP_AT, t);

/**
 * Recovery after a disk failure at `failureAt`. mode "backup": the base backup only. "archive": plus every shipped
 * segment. "pitr": replay stops at `target`. Returns { state, upTo, lost } or { error }.
 * lost counts the commits in (upTo, failureAt].
 */
export function restore(mode, failureAt, target = Infinity) {
  if (mode === "pitr" && target < BACKUP_AT) return { error: `${hhmm(target)} is before the backup ended at ${hhmm(BACKUP_AT)}.` };
  const shipped = SEGMENT * Math.floor(failureAt / SEGMENT);
  const upTo = mode === "backup" ? BACKUP_AT : mode === "archive" ? shipped : Math.min(target, shipped);
  return { state: stateAt(upTo), upTo, lost: LOG.filter(e => e.t > upTo && e.t <= failureAt).length };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Everything the page shows for a restore: status line, stat tiles and one row per logged commit; stats are [value, label] for statTile. */
export function describe(mode, failureAt, target) {
  const r = restore(mode, failureAt, target);
  if (r.error) return { status: `Refused: ${r.error}`, stats: null, rows: LOG.map(e => ({ time: hhmm(e.t), text: text(e), mark: "" })) };
  const { accounts, audit } = r.state;
  return {
    status: `Restored to ${hhmm(r.upTo)}. Lost ${plural(r.lost, "commit")}.`,
    stats: [[accounts.Alice, "Alice"], [accounts.Bob, "Bob"], [audit ? plural(audit.length, "row") : "dropped", "audit"]],
    rows: LOG.map(e => ({ time: hhmm(e.t), text: text(e), mark: e.t <= r.upTo ? "kept" : e.t <= failureAt ? "lost" : "" })),
  };
}

/**
 * A row-by-row copy of the two accounts while a transfer of `amount` runs: every interleaving of the copy's two reads
 * with the transfer's debit and credit. The WAL records the new value of each row, so replaying it over the copy
 * overwrites whatever the copy caught. Each run: { order, copy, total, replayed, replayedTotal }.
 */
export function fuzzyCopy(amount) {
  const { Alice, Bob } = START.accounts, wal = { Alice: Alice - amount, Bob: Bob + amount };
  const runs = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const live = { Alice, Bob }, copy = {}, order = [];
    let readsDone = 0, writesDone = 0;
    for (let k = 0; k < 4; k++) {
      if (k === i || k === j) { const key = readsDone++ ? "Bob" : "Alice"; copy[key] = live[key]; order.push(`read ${key}`); }
      else { const key = writesDone++ ? "Bob" : "Alice"; live[key] = wal[key]; order.push(`write ${key}`); }
    }
    const replayed = { ...copy, ...wal }, sum = o => o.Alice + o.Bob;
    runs.push({ order, copy, total: sum(copy), replayed, replayedTotal: sum(replayed) });
  }
  return runs;
}
