import { test } from "node:test";
import assert from "node:assert/strict";
import { contend, pairCollision, twoStations, throughput, CW_START, CW_MAX, DATA, RTS } from "./wifi.js";

test("model constants", () => {
  assert.deepEqual([CW_START, CW_MAX, DATA, RTS], [16, 1024, 20, 2]);
});

test("two stations on 16 slots collide with probability 1/16: all 256 pairs, then a seeded run", () => {
  assert.deepEqual(pairCollision(16), { same: 16, pairs: 256, p: 0.0625 });
  const r = contend({ n: 2, rounds: 10000, doubling: false, seed: 1 });
  assert.ok(Math.abs(r.fraction - 0.0625) < 0.01);
  assert.equal(r.fraction, 0.0616); // printed on the page
});

test("a fixed window collides more as stations are added; doubling is better at 20", () => {
  const f = n => contend({ n, rounds: 10000, doubling: false, seed: 1 }).fraction;
  const vals = [2, 5, 10, 20].map(f);
  assert.deepEqual(vals, [0.0616, 0.1484, 0.2835, 0.4998]); // printed on the page
  assert.ok(vals.every((v, i) => !i || v > vals[i - 1]));
  const d = contend({ n: 20, rounds: 10000, doubling: true, seed: 1 }).fraction;
  assert.equal(d, 0.2334);
  assert.ok(d < vals[3]);
});

test("a hidden pair loses far more frames than a pair that hears each other", () => {
  const hear = twoStations({ hidden: false, rts: false, slots: 20000 }), hid = twoStations({ hidden: true, rts: false, slots: 20000 });
  assert.deepEqual([hear.lostFrames, hid.lostFrames], [2, 200]); // printed
  assert.deepEqual([hear.sent, hid.sent], [309, 402]);
  assert.ok(hid.lostFrames > hear.lostFrames && hid.lostFraction > hear.lostFraction);
});

test("RTS/CTS cuts the airtime a hidden pair loses, because only short RTS frames collide", () => {
  const no = twoStations({ hidden: true, rts: false, slots: 20000 }), yes = twoStations({ hidden: true, rts: true, slots: 20000 });
  assert.equal(no.lostAirtime, 0.14295);
  assert.equal(yes.lostAirtime, 0.00025);
  assert.ok(yes.lostAirtime < no.lostAirtime);
  assert.ok(yes.delivered > no.delivered);
  // holds across seeds, not just the printed one
  for (let seed = 1; seed <= 20; seed++) {
    const a = twoStations({ hidden: true, rts: false, slots: 20000, seed }), b = twoStations({ hidden: true, rts: true, slots: 20000, seed });
    assert.ok(b.lostAirtime < a.lostAirtime && a.lostFrames > twoStations({ hidden: false, rts: false, slots: 20000, seed }).lostFrames, `seed ${seed}`);
  }
});

test("a slow station drags a fast one down to the same speed", () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  const mixed = throughput([6, 54]), fast = throughput([54, 54]);
  close(mixed.each, 5.4); close(mixed.total, 10.8);
  close(fast.each, 27); close(fast.total, 54);
});
