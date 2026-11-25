import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLan, loop, HOSTS, TIMEOUT } from "./switches.js";

const mac = n => HOSTS.find(h => h.name === n).mac;

test("empty table: the first frame floods except its own port, the reply goes to one port", () => {
  const lan = makeLan();
  assert.deepEqual(lan.sendFrame("A", "B").out, [2, 3, 4]);
  assert.deepEqual(lan.entries(), { [mac("A")]: 1 });
  assert.deepEqual(lan.sendFrame("B", "A").out, [1]);
  assert.deepEqual(lan.entries(), { [mac("A")]: 1, [mac("B")]: 2 });
});

test("once both are learned, A to B goes out exactly port 2", () => {
  const lan = makeLan();
  lan.sendFrame("A", "B"); lan.sendFrame("B", "A");
  assert.deepEqual(lan.sendFrame("A", "B").out, [2]);
});

test("an entry older than the timeout is gone and the frame floods again", () => {
  const lan = makeLan();
  lan.sendFrame("A", "B", 0); lan.sendFrame("B", "A", 0);
  assert.deepEqual(lan.sendFrame("A", "B", TIMEOUT).out, [2]);
  assert.deepEqual(lan.sendFrame("A", "B", TIMEOUT + 1).out, [2, 3, 4]);
  assert.equal(lan.entries()[mac("B")], undefined);
});

test("entries(now) hides an entry past the timeout even if nobody sent to it", () => {
  const lan = makeLan();
  lan.sendFrame("A", "B", 0); lan.sendFrame("B", "A", 0); lan.sendFrame("A", "C", TIMEOUT + 1);
  assert.deepEqual(lan.entries(TIMEOUT + 1), { [mac("A")]: 1 });
  assert.deepEqual(lan.entries(TIMEOUT), { [mac("A")]: 1, [mac("B")]: 2 });
});

test("a host that moves is reached on the old port until it sends a frame", () => {
  const lan = makeLan();
  lan.sendFrame("A", "B"); lan.sendFrame("B", "A");
  lan.move("B", 3);
  assert.deepEqual(lan.sendFrame("A", "B").out, [2]);
  assert.deepEqual(lan.sendFrame("B", "A").out, [1]);
  assert.deepEqual(lan.sendFrame("A", "B").out, [3]);
});

test("ARP: the first packet costs one flooded request and one reply to A alone, the second costs none", () => {
  const lan = makeLan();
  const first = lan.send("A", "10.0.0.2");
  assert.deepEqual(first.map(f => f.kind), ["arp-request", "arp-reply", "data"]);
  assert.deepEqual(first[0].out, [2, 3, 4]);
  assert.deepEqual(first[1].out, [1]);
  assert.deepEqual(first[2].out, [2]);
  const second = lan.send("A", "10.0.0.2");
  assert.deepEqual(second.map(f => f.kind), ["data"]);
});

test("off the network: A asks for the router's MAC, and the IP destination stays", () => {
  const lan = makeLan();
  const fs = lan.send("A", "203.0.113.5");
  assert.equal(fs[0].arpTarget, "10.0.0.254");
  assert.equal(fs.filter(f => f.kind === "arp-request").length, 1);
  const data = fs.at(-1);
  assert.equal(data.dst, mac("Router"));
  assert.equal(data.dstIp, "203.0.113.5");
  assert.deepEqual(data.out, [4]);
});

test("loop: two cables keep a broadcast alive at step 100, one blocked cable ends it", () => {
  const open = loop({ steps: 100 });
  assert.equal(open.inFlight, 2);
  assert.equal(open.delivered, 100); // two more copies to B every other step, printed
  const cut = loop({ blocked: true, steps: 100 });
  assert.equal(cut.inFlight, 0);
  assert.equal(cut.delivered, 1);
});

test("the page's constants", () => {
  assert.equal(TIMEOUT, 300);
  assert.equal(HOSTS.length, 4);
});
