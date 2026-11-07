import { test } from "node:test";
import assert from "node:assert/strict";
import { events, deliver } from "./websockets.js";
import { mulberry } from "../../shared/random.js";

const evs = events({ perMin: 6, seconds: 600, rnd: mulberry(1) });

test("events arrive at about the requested rate", () => {
  const many = events({ perMin: 6, seconds: 60000, rnd: mulberry(2) }); assert.ok(Math.abs(many.length / 1000 - 6) < 0.3, `${many.length}`);
});

test("polling: average delay is about half the interval, and requests don't depend on traffic", () => {
  const r = deliver("poll", evs, { interval: 10 });
  assert.ok(Math.abs(r.avg - 5) < 1, `${r.avg}`); assert.equal(r.requests, 60);
  assert.equal(deliver("poll", [], { interval: 10 }).requests, 60, "60 requests even with nothing to say");
});

test("long polling: near-instant delivery, about one request per event plus timeouts", () => {
  const r = deliver("long", evs);
  assert.ok(r.avg < 0.2, `${r.avg}`); assert.equal(r.latency.length, evs.length);
  assert.ok(r.requests <= evs.length + 600 / 30 + 1 && r.requests >= evs.length, `${r.requests} for ${evs.length}`);
  assert.ok(deliver("long", []).requests <= 20, "idle: one request per 30 s timeout");
});

test("a WebSocket delivers in half a round trip with a tiny fraction of the bytes", () => {
  const ws = deliver("ws", evs), poll = deliver("poll", evs, { interval: 10 });
  assert.ok(Math.abs(ws.avg - 0.05) < 1e-9); assert.equal(ws.requests, 1);
  assert.ok(deliver("long", events({ perMin: 60, rnd: mulberry(3) })).requests > poll.requests, "busy streams make long polling worse than polling"); assert.ok(ws.bytes * 20 < poll.bytes, `${ws.bytes} vs ${poll.bytes}`);
});
