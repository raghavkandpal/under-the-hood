import { test } from "node:test";
import assert from "node:assert/strict";
import { sign, verify, decode } from "./jwt.js";

const SECRET = "server-secret", claims = { sub: "ada", role: "user", exp: 2000 };

test("a token anyone can read, that only the server can make", async () => {
  const t = await sign(claims, SECRET);
  assert.equal(t.split(".").length, 3); assert.deepEqual(decode(t).payload, claims, "the payload is just base64url, not encrypted");
  assert.deepEqual((await verify(t, SECRET, { now: 1000 })).claims, claims);
});

test("editing the payload breaks the signature", async () => {
  const [h, , s] = (await sign(claims, SECRET)).split("."), forged = Buffer.from(JSON.stringify({ ...claims, role: "admin" })).toString("base64url");
  assert.match((await verify(`${h}.${forged}.${s}`, SECRET, { now: 1000 })).error, /signature/);
});

test("the signature matches an independent HMAC-SHA256", async () => {
  const { createHmac } = await import("node:crypto"), t = await sign(claims, SECRET), head = t.slice(0, t.lastIndexOf("."));
  assert.equal(t.split(".")[2], createHmac("sha256", SECRET).update(head).digest("base64url"));
});

test("expired tokens are refused, even with a valid signature", async () => {
  assert.equal((await verify(await sign(claims, SECRET), SECRET, { now: 2000 })).error, "expired");
});

test("alg none: a verifier that trusts the header accepts an unsigned forgery", async () => {
  const forged = await sign({ ...claims, role: "admin" }, "", { alg: "none", typ: "JWT" });
  assert.equal(forged.endsWith("."), true);
  assert.equal((await verify(forged, SECRET, { now: 1000, trustHeader: true })).claims.role, "admin");
  assert.match((await verify(forged, SECRET, { now: 1000 })).error, /algorithm none/);
});
