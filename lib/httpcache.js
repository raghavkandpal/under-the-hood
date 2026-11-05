// HTTP caching across browser → CDN → origin, with max-age, s-maxage, ETags and no-store. Times in seconds. No DOM.

export const LAT = { browser: 0, cdn: 0.02, origin: 0.15 };

export class Origin {
  constructor(size = 200_000) { this.version = 1; this.size = size; }
  get etag() { return `"v${this.version}"`; }
  deploy() { this.version++; }
}

export class Cache {
  constructor(name, shared) { this.name = name; this.shared = shared; this.entry = null; }
  ttl(h) { return this.shared && h.sMaxAge != null ? h.sMaxAge : h.maxAge; }
  fresh(now) { return this.entry && now - this.entry.at < this.entry.ttl; }
}

/**
 * One request from the browser. headers: { maxAge, sMaxAge, etag: bool, noStore: bool }.
 * Returns { version, steps: [{where, what}], bytes, ms }.
 */
export function request(now, browser, cdn, origin, h) {
  const steps = [], say = (where, what) => steps.push({ where, what });
  let bytes = 0, ms = 0;
  const fetchFrom = (layer, cond) => {
    // ask the next layer; cond = etag we already hold (or null)
    if (layer === "origin") {
      ms += LAT.origin;
      if (cond && h.etag && cond === origin.etag) { bytes += 200; say("origin", `304 Not Modified: ${origin.etag} is still current (no body sent)`); return { notModified: true, etag: origin.etag, version: origin.version }; }
      bytes += origin.size; say("origin", `200 OK: sent version ${origin.version} (${(origin.size / 1000).toFixed(0)} KB)`);
      return { version: origin.version, etag: origin.etag };
    }
    // CDN
    ms += LAT.cdn;
    if (!h.noStore && cdn.fresh(now)) {
      const e = cdn.entry;
      if (cond && h.etag && cond === e.etag) { bytes += 200; say("cdn", `304 from CDN cache (fresh for ${(e.ttl - (now - e.at)).toFixed(0)} more s)`); return { notModified: true, etag: e.etag, version: e.version }; }
      bytes += origin.size; say("cdn", `HIT: CDN served its cached version ${e.version} without asking the origin`); return { version: e.version, etag: e.etag };
    }
    say("cdn", h.noStore ? "no-store: CDN may not keep it, passing through" : cdn.entry ? "CDN copy is stale, asking origin" : "MISS: CDN has nothing, asking origin");
    const held = !h.noStore && cdn.entry ? cdn.entry.etag : null;
    const r = fetchFrom("origin", held);
    if (r.notModified) { cdn.entry.at = now; cdn.entry.ttl = cdn.ttl(h); }
    else if (!h.noStore) cdn.entry = { version: r.version, etag: r.etag, at: now, ttl: cdn.ttl(h) };
    const v = r.notModified ? cdn.entry.version : r.version, et = r.notModified ? cdn.entry.etag : r.etag;
    if (cond && h.etag && cond === et) { say("cdn", "304 to browser: its copy matches"); return { notModified: true, etag: et, version: v }; }
    bytes += r.notModified ? origin.size : 0; // CDN now sends the full body to the browser
    return { version: v, etag: et };
  };
  if (!h.noStore && browser.fresh(now)) { say("browser", `fresh in browser cache (age ${(now - browser.entry.at).toFixed(0)} s < max-age ${browser.entry.ttl} s): no network at all`); return { version: browser.entry.version, steps, bytes, ms }; }
  say("browser", h.noStore ? "no-store: never cached, must fetch" : browser.entry ? (h.etag ? `copy is stale: revalidating with If-None-Match: ${browser.entry.etag}` : "copy is stale and has no ETag: full fetch") : "nothing cached: full fetch");
  const held = !h.noStore && browser.entry && h.etag ? browser.entry.etag : null;
  const r = fetchFrom("cdn", held);
  let version;
  if (r.notModified) { browser.entry.at = now; browser.entry.ttl = h.maxAge; version = browser.entry.version; }
  else { version = r.version; if (!h.noStore) browser.entry = { version, etag: r.etag, at: now, ttl: h.maxAge }; }
  return { version, steps, bytes, ms };
}
