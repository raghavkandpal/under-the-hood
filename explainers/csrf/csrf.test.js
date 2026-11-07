import { test } from "node:test";
import assert from "node:assert/strict";
import { outcome, good, SCENARIOS, DEFENCES } from "./csrf.js";

test("with no defence, every forged request moves money", () => {
  for (const k of ["form", "getLink", "fetch"]) assert.equal(outcome(k, "none"), "transfer", k);
  assert.equal(outcome("legit", "none"), "transfer");
});

test("SameSite=Lax stops forged POSTs, but not a GET that changes state", () => {
  assert.equal(outcome("form", "lax"), "logged out"); assert.equal(outcome("fetch", "lax"), "logged out");
  assert.equal(outcome("getLink", "lax"), "transfer"); assert.equal(outcome("emailLink", "lax"), "page");
});

test("Strict stops everything cross-site, including the harmless link from your email", () => {
  for (const k of ["form", "getLink", "fetch"]) assert.ok(good(k, "strict"));
  assert.equal(outcome("emailLink", "strict"), "logged out"); assert.ok(!good("emailLink", "strict"));
});

test("a token stops forged POSTs; GETs must still never change state", () => {
  assert.equal(outcome("form", "token"), "rejected"); assert.equal(outcome("fetch", "token"), "rejected"); assert.equal(outcome("legit", "token"), "transfer");
  assert.equal(outcome("getLink", "token"), "transfer");
  assert.equal(Object.keys(SCENARIOS).length * Object.keys(DEFENCES).length, 20);
});
