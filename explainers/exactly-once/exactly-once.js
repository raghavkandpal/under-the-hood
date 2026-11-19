// Exactly-once processing: a log of 100 payments, one consumer that commits its offset every 10 messages, a sink that sums them.
// No DOM. "Crash after p" means the consumer dies right after it processed message p (1-based) and before any commit that would follow.
import { mulberry } from "../../shared/random.js";

export const N = 100;
export const BATCH = 10;
// Model: 100 messages. Offsets 23 and 70 (0-based) carry the same payload on purpose: two genuine identical payments.
export const LOG = Array.from({ length: N }, (_, i) => ({ offset: i, payer: `acct-${(i * 7) % 13}`, amount: 20 + 3 * i }));
LOG[70] = { ...LOG[23], offset: 70 };
export const TRUE_SUM = LOG.reduce((s, m) => s + m.amount, 0);
const content = m => `${m.payer} pays ${m.amount}`;
export const payload = content;

/** Extra copies at-least-once counts when it crashes after p: between 1 and 10. */
export const extraAtLeastOnce = p => p - BATCH * Math.floor((p - 1) / BATCH);
/** Messages at-most-once loses when it crashes after p: between 0 and 9. */
export const lostAtMostOnce = p => BATCH * Math.ceil(p / BATCH) - p;

/**
 * One run: consume the log, crash after message `crashAt` (0 = no crash), restart from the committed offset, finish.
 * mode "commit-first" (at-most-once): commit the batch's end offset, then process it.
 * mode "process-first" (at-least-once): process, commit after every 10th message.
 * mode "transaction": sink writes and the offset commit land together at every 10th message; a crash discards the open batch.
 * dedupe: "none", "offset" (drop a repeated offset) or "content" (drop a repeated payload).
 * An email goes out for every message processed, outside the sink and its transaction.
 * Returns { count, sum, emails, committedAtCrash }.
 */
export function run(mode, crashAt = 0, dedupe = "none") {
  const sink = { count: 0, sum: 0, seen: new Set() };
  let committed = 0, emails = 0, draft = null;
  const pass = stopAfter => {
    for (let i = committed; i < N; i++) {
      if (mode === "commit-first" && i % BATCH === 0) committed = i + BATCH;
      if (mode === "transaction") draft ??= { count: sink.count, sum: sink.sum, seen: new Set(sink.seen) };
      const s = draft || sink, m = LOG[i], key = dedupe === "offset" ? m.offset : content(m);
      emails++;
      if (dedupe === "none" || !s.seen.has(key)) { s.seen.add(key); s.count++; s.sum += m.amount; }
      if (i + 1 === stopAfter) return true;
      if (mode !== "commit-first" && (i + 1) % BATCH === 0) { if (draft) { Object.assign(sink, draft); draft = null; } committed = i + 1; }
    }
    return false;
  };
  const crashed = pass(crashAt || Infinity);
  const committedAtCrash = crashed ? committed : null;
  draft = null; // a crash discards the open transaction
  if (crashed) pass(Infinity);
  return { count: sink.count, sum: sink.sum, emails, committedAtCrash };
}

/**
 * A producer appends N messages to a log; each ack is lost with probability `lossRate` and the producer resends.
 * With `idempotent`, the broker remembers the last sequence number per producer ID and drops a resend.
 * Returns the log length and how many resends the producer made.
 */
export function produce({ idempotent, lossRate = 0.2, seed = 7 }) {
  const rnd = mulberry(seed);
  let length = 0, resends = 0, lastSeq = -1;
  for (let seq = 0; seq < N; seq++) {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) resends++;
      if (!idempotent || seq > lastSeq) { length++; lastSeq = seq; }
      if (rnd() >= lossRate) break;
    }
  }
  return { length, resends };
}
