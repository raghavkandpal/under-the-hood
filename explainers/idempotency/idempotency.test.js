import { test } from "node:test";
import assert from "node:assert/strict";
import { pay, many } from "./idempotency.js";
import { mulberry } from "../../shared/random.js";

test("lost responses plus retries charge some customers twice", () => {
  const r = many({ n: 2000, lossReq: 0, lossResp: 0.1, keys: false, rnd: mulberry(1) });
  assert.ok(Math.abs(r.twice / 2000 - 0.1) < 0.02, `${r.twice}`);
});

test("lost requests alone never double-charge: the server never saw them", () => {
  assert.equal(many({ n: 2000, lossReq: 0.3, lossResp: 0, keys: false, rnd: mulberry(2) }).twice, 0);
});

test("with idempotency keys, nobody is charged twice, whatever is lost", () => {
  const r = many({ n: 2000, lossReq: 0.2, lossResp: 0.2, keys: true, rnd: mulberry(3) });
  assert.equal(r.twice, 0); assert.ok(r.once > 1900);
});

test("one payment's story", () => {
  const steps = [0.9, 0.05, 0.9, 0.9], r = pay({ lossReq: 0.1, lossResp: 0.1, keys: true, rnd: () => steps.shift() ?? 0.9 });
  assert.deepEqual(r.log.map(l => l.what), ["server charges the card", "response lost", "server: seen this key, replays the result", "client gets the confirmation"]);
  assert.equal(r.charges, 1);
});
