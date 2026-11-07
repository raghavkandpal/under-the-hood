import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, search, exact, points, recall } from "./vector-search.js";
import { mulberry } from "../../shared/random.js";

const data = points(2000, mulberry(1)), index = buildIndex(data, 32), q = [0.3, 0.7];

test("probing every cluster finds exactly the true nearest neighbours; one probe scans a fraction", () => {
  const all = search(index, q, 10, 32), one = search(index, q, 10, 1);
  assert.deepEqual(all.ids, exact(data, q, 10)); assert.equal(all.scanned, 2000);
  assert.ok(one.scanned < 200, `${one.scanned}`);
});

test("each extra probe buys recall with more scanning", () => {
  const rnd = mulberry(9), avg = probes => { let r = 0, sc = 0; for (let t = 0; t < 200; t++) { const p = data[Math.floor(rnd() * data.length)].map(v => v + (rnd() - 0.5) * 0.02), s = search(index, p, 10, probes); r += recall(s.ids, exact(data, p, 10)); sc += s.scanned; } return [r / 200, sc / 200]; };
  const [r1, s1] = avg(1), [r2, s2] = avg(2), [r4] = avg(4);
  assert.ok(r1 > 0.8 && r1 < 0.95, `${r1}`); assert.ok(r2 > r1 && r4 >= r2, `${r1} ${r2} ${r4}`); assert.ok(s2 > s1 && s1 < 0.05 * 2000, `${s1} ${s2}`);
});
