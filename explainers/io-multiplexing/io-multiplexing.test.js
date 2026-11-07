import { test } from "node:test";
import assert from "node:assert/strict";
import { model, COST } from "./io-multiplexing.js";

test("poll's overhead grows with every idle connection; epoll's doesn't", () => {
  const p1 = model("poll", 1000, 0.1), p2 = model("poll", 4000, 0.025);  // same 100 requests a second
  assert.ok(p2.overhead > 3.5 * p1.overhead, `${p2.overhead} vs ${p1.overhead}`);
  assert.ok(Math.abs(model("epoll", 1000, 0.1).overhead - model("epoll", 4000, 0.025).overhead) < 1e-12);
});

test("10,000 connections at one request a second each: poll is saturated, epoll uses about a fifth of a core", () => {
  const p = model("poll", 10000, 1), e = model("epoll", 10000, 1), t = model("threads", 10000, 1);
  assert.equal(p.cpu, 1); assert.ok(p.overhead > 0.7, `poll overhead ${p.overhead}`);
  assert.ok(e.cpu > 0.2 && e.cpu < 0.22, `${e.cpu}`); assert.ok(t.cpu > 0.25 && t.cpu < 0.27, `${t.cpu}`);
  assert.equal(Math.round(t.memory / 2 ** 20), 781); assert.ok(e.memory < t.memory / 50);
});

test("under load the loop batches, so the period stays finite until the work alone needs a whole core", () => {
  const e = model("poll", 10000, 4); assert.ok(e.latency > 0.001 && e.latency < 0.01, `${e.latency}`);
  assert.ok(model("epoll", 10000, 1 / (10000 * COST.work)).overloaded);
});
