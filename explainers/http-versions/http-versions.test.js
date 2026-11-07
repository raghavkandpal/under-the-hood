import { test } from "node:test";
import assert from "node:assert/strict";
import { load, average } from "./http-versions.js";
import { mulberry } from "../../shared/random.js";

test("with no loss: 30 files take 2 + 5 round trips on HTTP/1.1, 2 + 3 on HTTP/2, 1 + 3 on HTTP/3", () => {
  const r = p => load(p, { files: 30, loss: 0, rnd: mulberry(1) }).total;
  assert.deepEqual([r("h1"), r("h2"), r("h3")], [7, 5, 4]);
});

test("HTTP/2 stalls every stream on one loss; HTTP/3 only the one that lost", () => {
  const h2 = load("h2", { files: 3, loss: 0.5, rnd: (() => { const s = [0.1, 0.9, 0.9, 0.9, 0.9, 0.9]; return () => s.shift() ?? 0.9; })() });
  assert.deepEqual(h2.files.map(f => f.stalls.length), [1, 1, 1]);
  const h3 = load("h3", { files: 3, loss: 0.5, rnd: (() => { const s = [0.1, 0.9, 0.9, 0.9]; return () => s.shift() ?? 0.9; })() });
  assert.deepEqual(h3.files.map(f => f.stalls.length), [1, 0, 0]);
});

test("at 2% loss HTTP/2 still beats HTTP/1.1; at 10% it is slower", () => {
  const avg = (p, loss, s) => average(p, { files: 30, loss }, 2000, mulberry(s));
  assert.ok(avg("h2", 0.02, 2) < avg("h1", 0.02, 3));
  assert.ok(avg("h2", 0.1, 4) > avg("h1", 0.1, 5), `${avg("h2", 0.1, 4)} vs ${avg("h1", 0.1, 5)}`);
  assert.ok(avg("h3", 0.1, 6) < avg("h1", 0.1, 7), "HTTP/3 wins at every loss rate");
});
