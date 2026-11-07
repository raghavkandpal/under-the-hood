// Replication lag: a leader and asynchronous followers. A user updates their profile and keeps reloading; where each
// read goes decides whether they see their own change, and whether time seems to run backwards. Times in ms. No DOM.

/**
 * Follower i applies each write `lag[i]` ms after the leader (plus a little jitter per write).
 * routing: "any" picks a random follower per read; "ryw" (read your writes) sends a user's reads to the leader for `window`
 * ms after their own write; "sticky" always reads one follower per user (monotonic reads).
 */
export function simulate({ lags = [40, 400], routing, writes = 3, readsPerWrite = 8, gap = 150, window = 1000, rnd }) {
  const reads = [];
  let version = 0, t = 0, lastWrite = -Infinity, best = 0;
  const sticky = Math.floor(rnd() * lags.length), applied = []; // applied[i][v] = time follower i has version v
  for (let w = 1; w <= writes; w++) {
    version = w; lastWrite = t;
    lags.forEach((lag, i) => ((applied[i] ??= [0])[w] = t + lag * (0.5 + rnd())));
    for (let k = 1; k <= readsPerWrite; k++) {
      const at = t + k * gap, replica = routing === "ryw" && at - lastWrite < window ? "leader" : routing === "sticky" ? sticky : Math.floor(rnd() * lags.length);
      const seen = replica === "leader" ? version : Math.max(...applied[replica].map((tt, v) => (tt <= at ? v : 0)));
      reads.push({ at, replica, seen, latest: version, stale: seen < version, backwards: seen < best });
      best = Math.max(best, seen);
    }
    t += (readsPerWrite + 1) * gap;
  }
  const count = k => reads.filter(r => r[k]).length;
  return { reads, stale: count("stale"), backwards: count("backwards"), leaderReads: reads.filter(r => r.replica === "leader").length };
}
