// IPv4 addresses, CIDR prefixes and longest-prefix matching. Addresses are unsigned 32-bit numbers. No DOM.

export function parse(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m || m.slice(1).some(o => +o > 255)) return null;
  return m.slice(1).reduce((a, o) => a * 256 + +o, 0);
}
export const format = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join(".");
export const bits = n => n.toString(2).padStart(32, "0");
export const mask = len => (len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0);

/** The block an address belongs to for a prefix length. /31 and /32 have no network or broadcast address to set aside (RFC 3021). */
export function block(ip, len) {
  const network = (ip & mask(len)) >>> 0, size = 2 ** (32 - len), broadcast = network + size - 1;
  const usable = len >= 31 ? size : size - 2;
  return { network, broadcast, size, usable, first: len >= 31 ? network : network + 1, last: len >= 31 ? broadcast : broadcast - 1, mask: mask(len) };
}
export const contains = (net, len, ip) => ((ip & mask(len)) >>> 0) === ((net & mask(len)) >>> 0);

/** Routers pick the most specific route that contains the address. routes: [{ prefix: "10.1.0.0/16", via }] */
export function route(routes, ip) {
  let best = null;
  for (const r of routes) { const [net, len] = r.prefix.split("/"); if (contains(parse(net), +len, ip) && (!best || +len > best.len)) best = { ...r, len: +len }; }
  return best;
}

/** Private ranges (RFC 1918) and a few special ones. */
export const SPECIAL = [["10.0.0.0", 8, "private"], ["172.16.0.0", 12, "private"], ["192.168.0.0", 16, "private"], ["127.0.0.0", 8, "loopback"], ["169.254.0.0", 16, "link-local"], ["100.64.0.0", 10, "carrier-grade NAT"]];
export const kind = ip => SPECIAL.find(([n, l]) => contains(parse(n), l, ip))?.[2] ?? "public";
