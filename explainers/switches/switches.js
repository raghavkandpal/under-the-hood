// Switches and ARP: a learning switch, ARP on one subnet, and a cabling loop. No DOM, so it runs in Node.
import { parse, contains } from "../../shared/subnets.js";

export const BROADCAST = "ff:ff:ff:ff:ff:ff";
export const TIMEOUT = 300; // model constant: seconds an entry survives without a frame from its host
export const NET = { net: parse("10.0.0.0"), len: 24 };
export const HOSTS = [
  { name: "A", port: 1, mac: "0a:00:00:00:00:01", ip: "10.0.0.1" },
  { name: "B", port: 2, mac: "0a:00:00:00:00:02", ip: "10.0.0.2" },
  { name: "C", port: 3, mac: "0a:00:00:00:00:03", ip: "10.0.0.3" },
  { name: "Router", port: 4, mac: "0a:00:00:00:00:fe", ip: "10.0.0.254" },
];
const PORTS = [1, 2, 3, 4];

/** The switch and the hosts on it. Hosts can be moved to another port; the switch only finds out from a frame. */
export function makeLan(timeout = TIMEOUT) {
  const table = new Map(); // mac -> { port, seen }
  const where = new Map(HOSTS.map(h => [h.name, h.port]));
  const arp = new Map(HOSTS.map(h => [h.name, new Map()])); // host -> ip -> mac
  const host = n => HOSTS.find(h => h.name === n);
  const byIp = ip => HOSTS.find(h => h.ip === ip);

  /** One frame enters on `inPort` at time `now`: learn the source, then pick the output ports. */
  function frame(f, inPort, now) {
    table.set(f.src, { port: inPort, seen: now });
    const e = table.get(f.dst);
    const known = e && f.dst !== BROADCAST && now - e.seen <= timeout;
    if (e && !known) table.delete(f.dst);
    const out = known ? (e.port === inPort ? [] : [e.port]) : PORTS.filter(p => p !== inPort);
    return { ...f, inPort, out };
  }
  const entries = () => Object.fromEntries([...table].map(([m, e]) => [m, e.port]));

  /** Host `name` sends a packet to `dstIp` at `now`. Returns the frames on the wire, in order. */
  function send(name, dstIp, now = 0) {
    const me = host(name), ip = parse(dstIp);
    const nextHop = contains(parse(me.ip), NET.len, ip) ? dstIp : "10.0.0.254";
    const frames = [], cache = arp.get(name);
    if (!cache.has(nextHop)) {
      const rq = frame({ kind: "arp-request", src: me.mac, dst: BROADCAST, arpTarget: nextHop }, where.get(name), now);
      frames.push(rq);
      const target = byIp(nextHop);
      if (target && rq.out.includes(where.get(target.name))) {
        frames.push(frame({ kind: "arp-reply", src: target.mac, dst: me.mac }, where.get(target.name), now));
        cache.set(nextHop, target.mac);
      }
    }
    if (cache.has(nextHop)) frames.push(frame({ kind: "data", src: me.mac, dst: cache.get(nextHop), dstIp }, where.get(name), now));
    return frames;
  }
  /** A bare frame between two hosts, with no ARP: for the learning rules. */
  const sendFrame = (from, to, now = 0) => frame({ kind: "data", src: host(from).mac, dst: host(to).mac }, where.get(from), now);
  return { frame, send, sendFrame, entries, move: (n, port) => where.set(n, port) };
}

/** Two switches joined by two cables, A on switch 1 and B on switch 2. Every switch floods a broadcast out of
 *  every other port. `blocked` takes the second cable out of service. A frame in flight is one on a cable. */
export function loop({ blocked = false, steps = 100 } = {}) {
  const cables = blocked ? [1] : [1, 2];
  let flying = []; // { to: switch, cable }
  let delivered = 0;
  // A's broadcast enters switch 1: out of every cable (host B is on switch 2, so nothing else on switch 1)
  for (const c of cables) flying.push({ to: 2, cable: c });
  const history = [flying.length];
  for (let s = 1; s <= steps && flying.length; s++) {
    const next = [];
    for (const f of flying) {
      if (f.to === 2) delivered++; // switch 2 delivers a copy to B
      for (const c of cables) if (c !== f.cable) next.push({ to: f.to === 1 ? 2 : 1, cable: c });
    }
    flying = next;
    history.push(flying.length);
  }
  return { inFlight: flying.length, history, delivered };
}
