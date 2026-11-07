import { test } from "node:test";
import assert from "node:assert/strict";
import { propagate, destination, LINKS } from "./bgp.js";

const bank = { prefix: "203.0.112.0/22", origin: 1 };

test("an announcement reaches every network along the shortest AS path, with no loops", () => {
  const t = propagate(LINKS, [bank]);
  for (const [as, routes] of Object.entries(t)) {
    const path = routes["203.0.112.0/22"]; assert.ok(path, `AS${as} has a route`);
    assert.equal(path.at(-1), 1); assert.equal(new Set(path).size, path.length, "no AS twice");
  }
  assert.deepEqual(t[7]["203.0.112.0/22"], [7, 3, 1]);
  assert.equal(destination(t, 7, "203.0.113.5"), 1);
});

const ases = [1, 2, 3, 4, 5, 6, 7, 8], hijacked = (t, ip) => ases.filter(a => a !== 8 && destination(t, a, ip) === 8).length;

test("a hijack of the same prefix captures the networks closer to the attacker", () => {
  const t = propagate(LINKS, [bank, { prefix: "203.0.112.0/22", origin: 8 }]), n = hijacked(t, "203.0.113.5");
  assert.ok(n > 0 && n < 6, `${n} of 7 networks go to the attacker`);
});

test("a more-specific hijack captures everyone, because the longest prefix wins", () => {
  assert.equal(hijacked(propagate(LINKS, [bank, { prefix: "203.0.113.0/24", origin: 8 }]), "203.0.113.5"), 7);
});

test("route origin validation drops both hijacks, but only on networks that check", () => {
  const roas = { "203.0.112.0/22": 1 }, all = [1, 2, 3, 4, 5, 6, 7];
  for (const prefix of ["203.0.112.0/22", "203.0.113.0/24"]) assert.equal(hijacked(propagate(LINKS, [bank, { prefix, origin: 8 }], { roas, rov: all }), "203.0.113.5"), 0, prefix);
  assert.ok(hijacked(propagate(LINKS, [bank, { prefix: "203.0.113.0/24", origin: 8 }], { roas, rov: [3] }), "203.0.113.5") > 0, "one network checking isn't enough");
});
