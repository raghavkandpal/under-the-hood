// A small, fictional DNS universe and an iterative resolver with a TTL cache. No DOM.

export const TLDS = {
  com: { server: "a.gtld-servers.test", ttl: 172800 },
  org: { server: "a0.org-servers.test", ttl: 172800 },
  net: { server: "a.gtld-servers.test", ttl: 172800 },
  dev: { server: "ns-tld1.dev-registry.test", ttl: 172800 },
};

// zone -> { ns, nsTtl, records: { name: { A?: ip, CNAME?: name, ttl } } }
export const ZONES = {
  "example.com": {
    ns: "ns1.example.com", nsTtl: 86400,
    records: {
      "example.com": { A: "93.184.0.10", ttl: 3600 },
      "www.example.com": { CNAME: "example.com", ttl: 300 },
      "api.example.com": { A: "93.184.0.42", ttl: 60 },
    },
  },
  "example.org": {
    ns: "ns.example.org", nsTtl: 86400,
    records: {
      "example.org": { A: "198.51.100.7", ttl: 3600 },
      "mail.example.org": { A: "198.51.100.25", ttl: 1800 },
    },
  },
  "hosting.net": {
    ns: "dns1.hosting.net", nsTtl: 86400,
    records: {
      "pages.hosting.net": { CNAME: "edge-7.cdn.hosting.net", ttl: 600 },
      "edge-7.cdn.hosting.net": { A: "203.0.113.77", ttl: 30 },
    },
  },
  "coffee.dev": {
    ns: "ns.coffee.dev", nsTtl: 86400,
    records: {
      "coffee.dev": { A: "192.0.2.5", ttl: 900 },
      "blog.coffee.dev": { CNAME: "pages.hosting.net", ttl: 3600 },
    },
  },
};

export const NEGATIVE_TTL = 300;
export const ROOT = "a.root-servers.test";

export const tldOf = name => name.split(".").at(-1);
export function zoneOf(name) {
  const parts = name.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const z = parts.slice(i).join(".");
    if (ZONES[z]) return z;
  }
  return parts.slice(-2).join("."); // the zone that *would* hold it
}

export class Cache {
  constructor() { this.map = new Map(); }
  get(key, now) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expires <= now) { this.map.delete(key); return null; }
    return e;
  }
  set(key, value, ttl, now) { this.map.set(key, { value, expires: now + ttl, ttl }); }
  entries(now) {
    const out = [];
    for (const [k, e] of this.map) if (e.expires > now) out.push({ key: k, ...e, remaining: e.expires - now });
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }
  purge(now) { for (const [k, e] of this.map) if (e.expires <= now) this.map.delete(k); }
}

/**
 * Resolve `qname` to an A record. Returns { hops, answer, chain, rcode }.
 * hops: [{ from, to, kind: "query"|"referral"|"answer"|"nxdomain"|"cache", text }]
 * Actors: "stub", "resolver", "root", "tld:<tld>", "auth:<zone>".
 */
export function resolve(qname, cache, now) {
  qname = qname.trim().toLowerCase().replace(/\.$/, "");
  const hops = [];
  const chain = [];
  const hop = (from, to, kind, text) => hops.push({ from, to, kind, text });
  hop("stub", "resolver", "query", `A? ${qname}`);

  let name = qname;
  for (let guard = 0; guard < 8; guard++) {
    // 1. Cached answer (positive or negative) for this exact name?
    const hit = cache.get(`${name} A`, now) || cache.get(`${name} CNAME`, now) || cache.get(`${name} NX`, now);
    if (hit) {
      const v = hit.value;
      hop("resolver", "resolver", "cache", v.nx ? `cache hit: ${name} doesn't exist (negative cache, ${hit.expires - now}s left)` : `cache hit: ${name} → ${v.CNAME ? "CNAME " + v.CNAME : v.A} (${hit.expires - now}s left)`);
      if (v.nx) { hop("resolver", "stub", "nxdomain", `NXDOMAIN ${qname}`); return { hops, chain, answer: null, rcode: "NXDOMAIN" }; }
      if (v.CNAME) { chain.push({ name, CNAME: v.CNAME }); name = v.CNAME; continue; }
      chain.push({ name, A: v.A });
      hop("resolver", "stub", "answer", `${qname} A ${v.A}`);
      return { hops, chain, answer: v.A, rcode: "NOERROR" };
    }

    // 2. Find the closest delegation we already know about.
    const tld = tldOf(name), zone = zoneOf(name);
    let zoneNs = cache.get(`${zone} NS`, now);
    let tldNs = cache.get(`${tld} NS`, now);

    if (!zoneNs) {
      if (!tldNs) {
        hop("resolver", "root", "query", `A? ${name}`);
        if (!TLDS[tld]) {
          hop("root", "resolver", "nxdomain", `NXDOMAIN: no such top-level domain .${tld}`);
          cache.set(`${name} NX`, { nx: true }, NEGATIVE_TTL, now);
          hop("resolver", "stub", "nxdomain", `NXDOMAIN ${qname}`);
          return { hops, chain, answer: null, rcode: "NXDOMAIN" };
        }
        hop("root", "resolver", "referral", `don't know, but .${tld} is served by ${TLDS[tld].server}`);
        cache.set(`${tld} NS`, { ns: TLDS[tld].server }, TLDS[tld].ttl, now);
      } else {
        hop("resolver", "resolver", "cache", `cache hit: .${tld} NS ${tldNs.value.ns}, skipping the root`);
      }
      hop("resolver", `tld:${tld}`, "query", `A? ${name}`);
      if (!ZONES[zone]) {
        hop(`tld:${tld}`, "resolver", "nxdomain", `NXDOMAIN: ${zone} isn't registered`);
        cache.set(`${name} NX`, { nx: true }, NEGATIVE_TTL, now);
        hop("resolver", "stub", "nxdomain", `NXDOMAIN ${qname}`);
        return { hops, chain, answer: null, rcode: "NXDOMAIN" };
      }
      hop(`tld:${tld}`, "resolver", "referral", `ask ${ZONES[zone].ns} for ${zone}`);
      cache.set(`${zone} NS`, { ns: ZONES[zone].ns }, ZONES[zone].nsTtl, now);
    } else {
      hop("resolver", "resolver", "cache", `cache hit: ${zone} NS ${zoneNs.value.ns}, going straight to it`);
    }

    // 3. Ask the authoritative server.
    hop("resolver", `auth:${zone}`, "query", `A? ${name}`);
    const rec = ZONES[zone].records[name];
    if (!rec) {
      hop(`auth:${zone}`, "resolver", "nxdomain", `NXDOMAIN: no ${name} in ${zone}`);
      cache.set(`${name} NX`, { nx: true }, NEGATIVE_TTL, now);
      hop("resolver", "stub", "nxdomain", `NXDOMAIN ${qname}`);
      return { hops, chain, answer: null, rcode: "NXDOMAIN" };
    }
    if (rec.CNAME) {
      hop(`auth:${zone}`, "resolver", "answer", `${name} CNAME ${rec.CNAME} (ttl ${rec.ttl})`);
      cache.set(`${name} CNAME`, { CNAME: rec.CNAME }, rec.ttl, now);
      chain.push({ name, CNAME: rec.CNAME });
      name = rec.CNAME;
      continue;
    }
    hop(`auth:${zone}`, "resolver", "answer", `${name} A ${rec.A} (ttl ${rec.ttl})`);
    cache.set(`${name} A`, { A: rec.A }, rec.ttl, now);
    chain.push({ name, A: rec.A });
    hop("resolver", "stub", "answer", `${qname} A ${rec.A}`);
    return { hops, chain, answer: rec.A, rcode: "NOERROR" };
  }
  hop("resolver", "stub", "nxdomain", "SERVFAIL: CNAME chain too long");
  return { hops, chain, answer: null, rcode: "SERVFAIL" };
}
