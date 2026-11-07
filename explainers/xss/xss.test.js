import { test } from "node:test";
import assert from "node:assert/strict";
import { render, runs, PAYLOADS, CONTEXTS } from "./xss.js";

const verdict = (ctx, p, d) => runs(render(ctx, PAYLOADS[p], d)) !== null;

test("with no defence, every attack runs in the context it was made for", () => {
  assert.ok(verdict("body", "script", "none")); assert.ok(verdict("attr", "handler", "none")); assert.ok(verdict("url", "jsurl", "none"));
  assert.ok(!verdict("body", "plain", "none"));
});

test("HTML escaping stops tags, but not an unquoted attribute or a javascript: link", () => {
  assert.ok(!verdict("body", "script", "escape"));
  assert.equal(render("body", PAYLOADS.script, "escape"), "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.ok(verdict("attr", "handler", "escape")); assert.ok(verdict("url", "jsurl", "escape"));
});

test("context-aware output stops every payload in every context, and keeps plain text intact", () => {
  for (const c in CONTEXTS) for (const p in PAYLOADS) assert.ok(!verdict(c, p, "context"), `${c} ${p}`);
  assert.equal(render("body", PAYLOADS.plain, "context"), "<p>Tom &amp; Jerry &lt;3</p>");
  assert.equal(render("url", "https://example.com", "context"), '<a href="https://example.com">my site</a>');
});

test("the checker sees through quoting", () => {
  assert.equal(runs('<img alt="x onerror=alert(1)">'), null); assert.ok(runs("<img alt=x onerror=alert(1)>"));
  assert.ok(runs('<img src="avatar.png" alt="" onmouseover="alert(1)">'));
});
