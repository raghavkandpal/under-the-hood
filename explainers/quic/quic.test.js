import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDSHAKE, firstByte, handshake, LIMIT, INITIAL, migrate, rttSamples, replay } from "./quic.js";
import { PROTOCOLS } from "../http-versions/http-versions.js";
import { mulberry } from "../../shared/random.js";

test("handshake counts agree with the HTTP versions page", () => {
  assert.equal(HANDSHAKE.tcp, PROTOCOLS.h2.handshake);
  assert.equal(HANDSHAKE.quic, PROTOCOLS.h3.handshake);
});

test("first response byte: TCP+TLS 3 RTT, QUIC 2, 0-RTT 1", () => {
  assert.deepEqual([firstByte("tcp"), firstByte("quic"), firstByte("zero")], [3, 2, 1]);
});

test("amplification: 3 x 1200 = 3600, and a 6000-byte flight needs one more RTT", () => {
  assert.equal(INITIAL, 1200); assert.equal(LIMIT, 3600);
  assert.equal(handshake(3600).rtt, 1);
  assert.equal(handshake(3601).rtt, 2);
  assert.deepEqual(handshake(6000), { first: 3600, blocked: 2400, rtt: 2 });
  assert.equal(handshake(2000).blocked, 0);
  for (let b = 0; b <= 3600; b += 100) assert.equal(handshake(b).rtt, 1);
});

test("migration: TCP waits 2 RTT for a handshake, QUIC adds none; validation takes 1 RTT alongside data", () => {
  const m = migrate();
  assert.equal(m.tcp.handshakeRtt, 2);
  assert.equal(m.quic.handshakeRtt, 0);
  assert.deepEqual(m.quic.validation, ["PATH_CHALLENGE", "PATH_RESPONSE"]);
  assert.equal(m.quic.validationRtt, 1);
  assert.equal(m.quic.answeredAt, 1); // the request does not wait for validation
  assert.equal(m.tcp.answeredAt, 3);
});

test("RTT samples: QUIC one per acked packet, TCP acked minus retransmitted", () => {
  const r = rttSamples(100, 0.1, mulberry(7));
  assert.deepEqual([r.sent, r.quic, r.tcp, r.retransmitted], [111, 100, 92, 8]); // seed 7, 10% loss
  assert.equal(r.tcp, r.acked - r.retransmitted);
  assert.ok(r.retransmitted > 0 && r.tcp < r.quic);
  // packet numbers only increase, even for retransmissions
  assert.ok(r.numbers.every((x, i) => i === 0 || x > r.numbers[i - 1]));
  assert.equal(r.sent, r.numbers.length);
  // more loss, fewer TCP samples on average (single seeds can cross: 18% vs 19%)
  const avg = l => [1, 2, 3, 4, 5].reduce((a, sd) => a + rttSamples(100, l, mulberry(sd)).tcp, 0) / 5;
  assert.ok(avg(0.05) > avg(0.1) && avg(0.1) > avg(0.2));
  const clean = rttSamples(50, 0, mulberry(7));
  assert.equal(clean.tcp, 50); assert.equal(clean.retransmitted, 0);
});

test("0-RTT replay: POST runs 4 times if accepted, once if only GET is accepted", () => {
  assert.equal(replay("POST", "all").runs, 4);
  assert.equal(replay("POST", "get-only").runs, 1);
  assert.equal(replay("POST", "get-only").accepted, false);
  assert.equal(replay("GET", "get-only").runs, 4); // safe to repeat, so the risk is accepted
  assert.equal(replay("POST", "all", 0).runs, 1);
});
