import { test } from "node:test";
import assert from "node:assert/strict";
import { run, digest } from "../lib/oauth.js";

test("happy path gives the app a token and never shows it the password", () => {
  for (const pkce of [true, false]) for (const state of [true, false]) {
    const r = run({ pkce, state }); assert.ok(r.outcome.ok);
    assert.ok(r.steps.some(s => s.kind === "secret" && s.to === "app"));
    assert.ok(!r.steps.some(s => /password=/.test(s.detail)));
  }
});

test("a stolen code works without PKCE and fails with it", () => {
  assert.equal(run({ pkce: false, attack: "steal-code" }).outcome.ok, false);
  const r = run({ pkce: true, attack: "steal-code" });
  assert.equal(r.outcome.ok, true); assert.ok(r.steps.some(s => s.kind === "blocked" && /verifier/.test(s.label)));
});

test("login CSRF works without state and fails with it", () => {
  assert.equal(run({ state: false, attack: "csrf" }).outcome.ok, false);
  assert.equal(run({ state: true, attack: "csrf" }).outcome.ok, true);
});

test("digest is deterministic and spreads", () => {
  assert.equal(digest("abc"), digest("abc")); assert.notEqual(digest("abc"), digest("abd")); assert.equal(digest("x").length, 8);
});
