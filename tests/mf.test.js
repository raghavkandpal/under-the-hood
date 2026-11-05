import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRatings, MF, heldOutRMSE, USERS, ITEMS } from "../lib/mf.js";

test("training error falls", () => {
  const { R, mask } = makeRatings(2), m = new MF(USERS.length, ITEMS.length, 2, 1);
  const e1 = m.epoch(R, mask); const eN = m.fit(R, mask, 400);
  assert.ok(eN < e1 * 0.6, `${e1} → ${eN}`);
});

test("predicts hidden ratings better than guessing the average", () => {
  let wins = 0;
  for (let s = 1; s <= 10; s++) {
    const { R, mask } = makeRatings(s), m = new MF(USERS.length, ITEMS.length, 2, s); m.fit(R, mask, 400);
    if (heldOutRMSE(R, mask, (u, i) => m.predict(u, i)) < heldOutRMSE(R, mask, () => m.mu)) wins++;
  }
  assert.ok(wins >= 8, String(wins));
});

test("learned item vectors put similar items close together", () => {
  const { R, mask } = makeRatings(3, 0.8), m = new MF(USERS.length, ITEMS.length, 2, 3); m.fit(R, mask, 600);
  const d = (a, b) => Math.hypot(m.Q[a][0] - m.Q[b][0], m.Q[a][1] - m.Q[b][1]);
  assert.ok(d(0, 1) < d(0, 3) && d(3, 5) < d(1, 5));
});
