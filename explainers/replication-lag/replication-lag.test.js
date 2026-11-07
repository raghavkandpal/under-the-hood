import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./replication-lag.js";
import { mulberry } from "../../shared/random.js";

const total = (routing, key, opts = {}) => { let s = 0; for (let i = 0; i < 200; i++) s += simulate({ routing, rnd: mulberry(i), ...opts })[key]; return s; };

test("reading any follower: you miss your own update, and sometimes go back in time", () => {
  assert.ok(total("any", "stale") > 500); assert.ok(total("any", "backwards") > 50);
});

test("read-your-writes: never stale after your own write, at the cost of leader reads", () => {
  assert.equal(total("ryw", "stale"), 0); assert.ok(simulate({ routing: "ryw", rnd: mulberry(1) }).leaderReads === 18);
});

test("sticky reads never go backwards, but can still be stale", () => {
  assert.equal(total("sticky", "backwards"), 0); assert.ok(total("sticky", "stale") > 0);
});

test("no lag, no anomalies", () => {
  assert.equal(total("any", "stale", { lags: [0, 0] }), 0);
});
