import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, format, block, route, kind, mask } from "./subnets.js";

test("parse and format round-trip, and reject nonsense", () => {
  assert.equal(format(parse("192.168.1.10")), "192.168.1.10"); assert.equal(parse("255.255.255.255"), 2 ** 32 - 1);
  assert.equal(parse("256.1.1.1"), null); assert.equal(parse("1.2.3"), null);
  assert.equal(format(mask(24)), "255.255.255.0"); assert.equal(format(mask(20)), "255.255.240.0"); assert.equal(mask(0), 0);
});

test("a /24 has 256 addresses and 254 usable hosts", () => {
  const b = block(parse("192.168.1.10"), 24);
  assert.deepEqual([format(b.network), format(b.broadcast), format(b.first), format(b.last), b.size, b.usable], ["192.168.1.0", "192.168.1.255", "192.168.1.1", "192.168.1.254", 256, 254]);
  const c = block(parse("10.20.37.200"), 20);
  assert.deepEqual([format(c.network), format(c.broadcast), c.usable], ["10.20.32.0", "10.20.47.255", 4094]);
  assert.equal(block(parse("10.0.0.1"), 31).usable, 2); assert.equal(block(parse("10.0.0.1"), 32).usable, 1);
});

test("the most specific route wins", () => {
  const routes = [{ prefix: "0.0.0.0/0", via: "isp" }, { prefix: "10.0.0.0/8", via: "vpn" }, { prefix: "10.1.2.0/24", via: "lab" }];
  assert.equal(route(routes, parse("10.1.2.3")).via, "lab"); assert.equal(route(routes, parse("10.9.9.9")).via, "vpn"); assert.equal(route(routes, parse("8.8.8.8")).via, "isp");
});

test("private ranges", () => {
  assert.equal(kind(parse("172.31.255.1")), "private"); assert.equal(kind(parse("172.32.0.1")), "public"); assert.equal(kind(parse("127.0.0.1")), "loopback");
});
