// Leases and fencing tokens: a client holding a lock pauses (say, for garbage collection), its lease expires, another
// client takes over, and the first one wakes up still believing it holds the lock. Times in seconds. No DOM.

/**
 * Client A acquires the lease at 0 and writes once it's done working; it pauses from pauseAt for pauseLen seconds.
 * Client B asks for the lease from t = 1 and gets it as soon as A's expires. Each grant carries a token, one higher each time.
 * With fencing, storage remembers the highest token it has seen and rejects anything older.
 */
export function simulate({ ttl = 10, pauseAt = 2, pauseLen = 15, work = 1, fencing }) {
  const tokenA = 33, tokenB = 34, aWrite = pauseAt + pauseLen + work, late = aWrite > ttl, bGets = late ? ttl : aWrite;
  const events = [{ t: 0, who: "A", what: `gets the lease, token ${tokenA}, valid ${ttl} s` }];
  if (pauseLen > 0) events.push({ t: pauseAt, who: "A", what: `pauses for ${pauseLen} s` });
  const storage = { value: "initial", maxToken: 0, writes: [] };
  for (const w of [{ t: aWrite, who: "A", token: tokenA }, { t: bGets + work, who: "B", token: tokenB }].sort((x, y) => x.t - y.t)) {
    const ok = !fencing || w.token >= storage.maxToken;
    if (ok) { storage.value = `${w.who}'s update`; storage.maxToken = Math.max(storage.maxToken, w.token); }
    storage.writes.push({ ...w, ok });
    events.push({ t: w.t, who: w.who, what: ok ? `writes with token ${w.token}` : `is rejected: token ${w.token} < ${storage.maxToken}` });
  }
  events.push(late ? { t: ttl, who: "lock", what: "A's lease expires" } : { t: aWrite, who: "A", what: "releases the lease" });
  events.push({ t: bGets, who: "B", what: `gets the lease, token ${tokenB}` });
  events.sort((x, y) => x.t - y.t);
  const b = storage.writes.find(w => w.who === "B"), a = storage.writes.find(w => w.who === "A");
  return { events, storage, stale: late, safe: !(late && a.ok && a.t > b.t) };
}
