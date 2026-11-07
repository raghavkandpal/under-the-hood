// BGP, the protocol between networks: each autonomous system (AS) tells its neighbours which address blocks it can
// reach and by which path of ASes. Path-vector propagation, hijacks, and origin validation (RPKI). No DOM.

import { parse, contains } from "../../shared/subnets.js";

/** A small made-up internet: who peers with whom. AS 8 will play the attacker. */
export const LINKS = [[1, 2], [1, 3], [2, 4], [3, 5], [3, 7], [4, 5], [4, 6], [5, 6], [6, 8], [7, 8]];

/**
 * Spread announcements ({ prefix, origin }) until nothing changes. Each AS keeps, per prefix, the shortest AS path
 * it has heard (ties: the lower neighbour), and ignores paths that already contain itself (loop prevention).
 * roas: { prefix: allowed origin }. With rov, an AS drops announcements whose origin isn't the one the ROA allows.
 */
export function propagate(links, announcements, { roas = {}, rov = [] } = {}) {
  const ases = [...new Set(links.flat())], table = Object.fromEntries(ases.map(a => [a, {}]));
  const valid = (prefix, origin) => (prefix in roas ? roas[prefix] === origin : covered(prefix, origin, roas));
  for (const { prefix, origin } of announcements) table[origin][prefix] = [origin];
  for (let changed = true; changed;) {
    changed = false;
    for (const [x, y] of links) for (const [from, to] of [[x, y], [y, x]]) for (const [prefix, path] of Object.entries(table[from])) {
      if (path.includes(to)) continue;
      if (rov.includes(to) && !valid(prefix, path.at(-1))) continue;
      const cand = [to, ...path], cur = table[to][prefix];
      if (!cur || cand.length < cur.length || (cand.length === cur.length && cand[1] < cur[1])) { table[to][prefix] = cand; changed = true; }
    }
  }
  return table;
}
/** A prefix with no ROA of its own is valid unless a broader ROA covers it with a different origin. */
function covered(prefix, origin, roas) {
  const [net, len] = prefix.split("/");
  return !Object.entries(roas).some(([p, o]) => { const [n, l] = p.split("/"); return +l < +len && contains(parse(n), +l, parse(net)) && o !== origin; });
}

/** The route `as` uses for `ip`: its most specific matching prefix, with the AS path. */
export function routeFor(table, as, ip) {
  const addr = parse(ip); let best = null;
  for (const [prefix, path] of Object.entries(table[as])) { const [n, l] = prefix.split("/"); if (contains(parse(n), +l, addr) && (!best || +l > best.len)) best = { len: +l, prefix, path }; }
  return best;
}
/** Where traffic from `as` to `ip` ends up: the origin at the end of that route. */
export const destination = (table, as, ip) => routeFor(table, as, ip)?.path.at(-1) ?? null;
