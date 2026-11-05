import { test } from "node:test";
import assert from "node:assert/strict";
import { Origin, Cache, request } from "../lib/httpcache.js";

const setup = () => ({ o: new Origin(), b: new Cache("browser", false), c: new Cache("cdn", true) });

test("fresh browser copy means zero network", () => {
  const { o, b, c } = setup(), h = { maxAge: 60, etag: true };
  request(0, b, c, o, h); const r = request(30, b, c, o, h);
  assert.equal(r.bytes, 0); assert.equal(r.ms, 0);
});

test("after expiry, an unchanged file revalidates with a tiny 304", () => {
  const { o, b, c } = setup(), h = { maxAge: 60, sMaxAge: 30, etag: true };
  request(0, b, c, o, h); const r = request(100, b, c, o, h);
  assert.ok(r.bytes < 1000 && r.steps.some(s => s.what.includes("304")));
});

test("a deploy is invisible until caches expire (stale content)", () => {
  const { o, b, c } = setup(), h = { maxAge: 3600, etag: true };
  request(0, b, c, o, h); o.deploy();
  assert.equal(request(100, b, c, o, h).version, 1);
  assert.equal(request(4000, b, c, o, h).version, 2);
});

test("CDN shields the origin for other users; no-store always goes to origin", () => {
  const { o, c } = setup(), h = { maxAge: 0, sMaxAge: 300, etag: true };
  request(0, new Cache("b1"), c, o, h); const r = request(10, new Cache("b2"), c, o, h);
  assert.ok(!r.steps.some(s => s.where === "origin"));
  const n = request(20, new Cache("b3"), c, o, { maxAge: 300, noStore: true });
  assert.ok(n.steps.some(s => s.where === "origin"));
});
