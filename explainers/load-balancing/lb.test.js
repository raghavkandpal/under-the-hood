import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "./lb.js";

const p99 = (strategy, o = {}) => simulate({ strategy, seed: 3, ...o }).p99;

test("random has the worst tail; two choices fixes most of it; least connections is best", () => {
  const rnd = p99("random"), two = p99("two"), least = p99("least");
  assert.ok(two < rnd * 0.6, `two ${two} vs random ${rnd}`);
  assert.ok(least <= two * 1.05, `least ${least} vs two ${two}`);
});

test("round robin is fine for uniform work but suffers with heavy-tailed requests", () => {
  const rrHeavy = p99("rr", { heavy: true }), leastHeavy = p99("least", { heavy: true });
  assert.ok(rrHeavy > leastHeavy * 1.5, `rr ${rrHeavy} vs least ${leastHeavy}`);
});

test("blind strategies keep sending traffic to slow servers", () => {
  const rr = p99("rr", { slow: 2 }), least = p99("least", { slow: 2 });
  assert.ok(rr > least * 2, `rr ${rr} vs least ${least}`);
});
