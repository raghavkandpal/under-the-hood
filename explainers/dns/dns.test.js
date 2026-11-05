import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, Cache } from "./dns.js";

const actors = r => r.hops.filter(h => h.kind === "query").map(h => h.to);

test("cold lookup walks root → tld → auth", () => {
  const r = resolve("api.example.com", new Cache(), 0);
  assert.equal(r.answer, "93.184.0.42");
  assert.deepEqual(actors(r), ["resolver", "root", "tld:com", "auth:example.com"]);
});

test("warm cache answers without any upstream query", () => {
  const c = new Cache();
  resolve("api.example.com", c, 0);
  const r = resolve("api.example.com", c, 10);
  assert.deepEqual(actors(r), ["resolver"]);
  assert.equal(r.answer, "93.184.0.42");
});

test("expired A record re-queries auth only (NS still cached)", () => {
  const c = new Cache();
  resolve("api.example.com", c, 0);
  const r = resolve("api.example.com", c, 61);
  assert.deepEqual(actors(r), ["resolver", "auth:example.com"]);
});

test("sibling domain under same TLD skips root", () => {
  const c = new Cache();
  resolve("api.example.com", c, 0);
  const r = resolve("www.example.com", c, 1);
  assert.ok(!actors(r).includes("root"));
});

test("CNAME chain across zones", () => {
  const r = resolve("blog.coffee.dev", new Cache(), 0);
  assert.equal(r.answer, "203.0.113.77");
  assert.deepEqual(r.chain.map(c => c.name), ["blog.coffee.dev", "pages.hosting.net", "edge-7.cdn.hosting.net"]);
});

test("NXDOMAIN cases and negative caching", () => {
  const c = new Cache();
  assert.equal(resolve("nope.example.com", c, 0).rcode, "NXDOMAIN");
  assert.deepEqual(actors(resolve("nope.example.com", c, 5)), ["resolver"]);
  assert.equal(resolve("unregistered.com", c, 0).rcode, "NXDOMAIN");
  assert.equal(resolve("foo.notatld", c, 0).rcode, "NXDOMAIN");
});
