// QUIC in depth: handshake counts, the amplification limit, migration, RTT samples and 0-RTT replay. No DOM.

/** Handshake round trips before the first request can be sent. TCP + TLS 1.3 is 2 (as PROTOCOLS.h2), QUIC 1, 0-RTT resumption 0. */
export const HANDSHAKE = { tcp: 2, quic: 1, zero: 0 };

/** Round trips until the first response byte: the handshake, then one for the request and response. */
export const firstByte = kind => HANDSHAKE[kind] + 1;

export const INITIAL = 1200, AMPLIFICATION = 3, LIMIT = AMPLIFICATION * INITIAL;

/**
 * Server flight of `bytes` after a client Initial padded to 1200 bytes. Until the address is validated the server
 * may send 3x what it received. The rest waits for the client's next packet, which validates the address: one RTT more.
 * shortcut: ignores the congestion window, which also caps a first flight.
 */
export function handshake(bytes) {
  const first = Math.min(bytes, LIMIT);
  return { first, blocked: bytes - first, rtt: bytes > LIMIT ? 2 : 1 };
}

/** The next request after the client's address changes. TCP is tied to the 4-tuple; QUIC to a connection ID. */
export function migrate() {
  return {
    tcp: { handshakeRtt: HANDSHAKE.tcp, answeredAt: firstByte("tcp") },
    quic: { handshakeRtt: 0, answeredAt: firstByte("zero"), validation: ["PATH_CHALLENGE", "PATH_RESPONSE"], validationRtt: 1 },
  };
}

/**
 * `n` packets over a link losing each transmission with probability `loss`; a lost one is sent again until it arrives.
 * QUIC numbers every transmission afresh, so each acknowledged packet is a clean RTT sample.
 * TCP keeps the sequence number, and Karn's rule discards samples from segments that were ever retransmitted.
 */
export function rttSamples(n, loss, rnd) {
  let pn = 0, retransmitted = 0; const numbers = [];
  for (let i = 0; i < n; i++) {
    let tries = 1; numbers.push(pn++);
    while (rnd() < loss) { tries++; numbers.push(pn++); }
    if (tries > 1) retransmitted++;
  }
  return { sent: pn, acked: n, retransmitted, quic: n, tcp: n - retransmitted, numbers };
}

/**
 * An attacker replays a captured 0-RTT first flight `replays` times. A server that accepts 0-RTT for the method runs
 * every copy. One that refuses makes the client resend over the finished 1-RTT handshake, and the replays die.
 */
export function replay(method, policy, replays = 3) {
  const accepts = policy === "all" || (policy === "get-only" && method === "GET");
  return { accepted: accepts, runs: accepts ? 1 + replays : 1 };
}
