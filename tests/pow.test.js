import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256hex, mine, verifyChain, blockText, meets } from "../lib/pow.js";

test("known SHA-256 vector", async () => {
  assert.equal(await sha256hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("mining finds a valid nonce; a chain verifies; tampering breaks it and every later link", async () => {
  const Z = 2, blocks = []; let prev = "0".repeat(64);
  for (const data of ["Alice pays Bob 5", "Bob pays Carol 2", "Carol pays Dan 1"]) {
    const r = await mine(prev, data, Z); assert.ok(meets(r.hash, Z));
    blocks.push({ prev, data, nonce: r.nonce, hash: r.hash }); prev = r.hash;
  }
  assert.deepEqual(await verifyChain(blocks, Z), []);
  blocks[1].data = "Bob pays Carol 200";
  assert.deepEqual(await verifyChain(blocks, Z), [1]);
  // re-mining block 1 fixes it but changes its hash, so block 2's link now fails
  const r = await mine(blocks[1].prev, blocks[1].data, Z); blocks[1].nonce = r.nonce; blocks[1].hash = r.hash;
  assert.deepEqual(await verifyChain(blocks, Z), [2]);
});

test("difficulty: each extra zero costs about 16× more tries", async () => {
  let t1 = 0, t2 = 0;
  for (let s = 0; s < 20; s++) { t1 += (await mine("p", "d" + s, 1)).tries; t2 += (await mine("p", "d" + s, 2)).tries; }
  assert.ok(t2 / t1 > 6 && t2 / t1 < 40, String(t2 / t1));
});
