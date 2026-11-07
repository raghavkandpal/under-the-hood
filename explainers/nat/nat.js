// NAT: many private addresses share one public one. The router rewrites each outgoing packet's source and
// remembers the mapping so replies find their way back. Plus UDP hole punching between two NATs. No DOM.
// Packets are { src, dst } with "ip:port" strings.

/**
 * mapping: "independent" reuses one public port per inside address for every destination ("easy" NAT);
 * "dependent" picks a new public port per destination (symmetric NAT).
 * Filtering is address-and-port dependent: inbound packets pass only from endpoints the inside host has sent to.
 */
export function makeNat(publicIp, mapping = "independent", firstPort = 40000) {
  let next = firstPort;
  const table = [];
  return {
    publicIp, mapping, table,
    /** Outgoing: rewrite the source to a public port, creating the mapping if needed. */
    out({ src, dst }) {
      let e = table.find(e => e.inside === src && (mapping === "independent" || e.remote === dst));
      if (!e) table.push(e = { inside: src, pub: `${publicIp}:${next++}`, remote: dst, allowed: new Set() });
      e.allowed.add(dst);
      return { src: e.pub, dst };
    },
    /** Incoming: rewrite the destination back to the inside address, or drop with a reason. */
    in({ src, dst }) {
      const es = table.filter(e => e.pub === dst);
      if (!es.length) return { drop: "no mapping" };
      const e = es.find(e => e.allowed.has(src));
      return e ? { src, dst: e.inside } : { drop: "not expected from this sender" };
    },
  };
}

export const RENDEZVOUS = "198.51.100.1:3478";
/**
 * Hole punching. Both peers ask a rendezvous server for their public endpoint, swap them, then send to each
 * other at the same moment. Each NAT has now "sent to" the other side, so the other side's packet is let in,
 * as long as it arrives from the endpoint that was announced.
 */
export function holePunch(typeA, typeB) {
  const A = { nat: makeNat("203.0.113.7", typeA, 40000), host: "192.168.1.10:5000" };
  const B = { nat: makeNat("198.51.100.77", typeB, 61000), host: "10.0.0.20:6000" };
  const steps = [];
  const seen = p => { const r = p.nat.out({ src: p.host, dst: RENDEZVOUS }); return r.src; };
  const eA = seen(A), eB = seen(B);
  steps.push({ what: "server", text: `Server sees A at ${eA} and B at ${eB}, and tells each the other's address` });
  const ab = A.nat.out({ src: A.host, dst: eB }), ba = B.nat.out({ src: B.host, dst: eA });
  const atB = B.nat.in(ab), atA = A.nat.in(ba);
  for (const [from, to, sent, announced, got] of [["A", "B", ab, eA, atB], ["B", "A", ba, eB, atA]])
    steps.push({ what: from + to, ok: !got.drop, text: `${from} → ${to}: leaves from ${sent.src}${sent.src === announced ? "" : ` (not ${announced})`}, ${got.drop ? "dropped: " + got.drop : "delivered"}` });
  return { steps, direct: !atA.drop && !atB.drop };
}
