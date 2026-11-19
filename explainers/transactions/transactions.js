// Transactions: all or nothing. A two-row table, a CHECK balance >= 0 and a SQLite-style rollback journal.
// No DOM. A step is one statement or BEGIN/COMMIT/ROLLBACK; the crash points are the gaps between steps.

export const START = { Alice: 100, Bob: 50 };
export const total = d => d.Alice + d.Bob;

/** Moves `amount` from Alice to Bob as two UPDATEs; creditFirst runs Bob's credit before Alice's debit. */
export function transferOps(amount, creditFirst = false) {
  const ops = [{ key: "Alice", delta: -amount }, { key: "Bob", delta: amount }];
  return creditFirst ? ops.reverse() : ops;
}

const label = o => `UPDATE ${o.key} ${o.delta < 0 ? "-" : "+"} ${Math.abs(o.delta)}`;

/**
 * Every state of the run, state[i] being the state after i steps (state[0] is before anything ran).
 * mode "auto": each UPDATE commits itself. mode "txn": BEGIN, the UPDATEs, then COMMIT or ROLLBACK.
 * In a transaction the original value is journaled before the file is changed, and COMMIT deletes the journal.
 * An UPDATE that breaks the CHECK fails; a transaction then rolls back, autocommit keeps the earlier statements.
 * Each state: { step, disk, journal (null, or the originals), view (what another session reads), error }.
 */
export function timeline(mode, ops, { rollback = false } = {}) {
  const txn = mode === "txn";
  const states = [{ step: "start", disk: { ...START }, journal: null, view: { ...START }, error: null }];
  const push = (step, disk, journal, error = null) =>
    states.push({ step, disk, journal, view: { ...disk, ...journal }, error });
  const last = () => states[states.length - 1];
  const undo = () => push("ROLLBACK", { ...last().disk, ...last().journal }, null);
  if (txn) push("BEGIN", { ...START }, {});
  for (const o of ops) {
    const { disk, journal } = last(), next = disk[o.key] + o.delta;
    if (next < 0) {
      push(label(o), disk, journal, `CHECK failed: ${o.key} would be ${next}`);
      if (txn) undo();
      return states;
    }
    push(label(o), { ...disk, [o.key]: next }, txn ? { [o.key]: disk[o.key], ...journal } : null);
  }
  if (txn) rollback ? undo() : push("COMMIT", { ...last().disk }, null);
  return states;
}

/** What the table holds after a crash at this state and a restart: a hot journal is rolled back. */
export const restart = s => ({ ...s.disk, ...s.journal });

/** The restarted table for every crash point, 0 (before anything) to the last step. */
export const crashSweep = (mode, ops, opts) => timeline(mode, ops, opts).map(restart);
