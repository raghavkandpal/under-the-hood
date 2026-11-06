import { test } from "node:test";
import assert from "node:assert/strict";
import { satisfies, resolve, nested, REGISTRY, withRelease } from "./dependency-resolution.js";

test("semver ranges", () => {
  assert.ok(satisfies("1.4.2", "^1.2.0") && !satisfies("2.0.0", "^1.2.0") && !satisfies("1.1.9", "^1.2.0"));
  assert.ok(satisfies("0.2.5", "^0.2.0") && !satisfies("0.3.0", "^0.2.0")); // 0.x: minor is the breaking part
  assert.ok(satisfies("1.2.9", "~1.2.0") && !satisfies("1.3.0", "~1.2.0"));
  assert.ok(satisfies("9.9.9", ">=1.0.0") && satisfies("1.0.0", "1.0.0") && !satisfies("1.0.1", "1.0.0") && satisfies("0.0.1", "*"));
});

test("the diamond: newest web needs http 3, the logger needs http 2, so the resolver backs off to web 2.0", () => {
  const r = resolve({ web: "^2.0.0", log: "^1.0.0" }, REGISTRY);
  assert.ok(r.ok); assert.equal(r.chosen.web, "2.0.0"); assert.equal(r.chosen.http, "2.4.1"); assert.ok(r.backtracks >= 1);
  for (const [pkg, v] of Object.entries(r.chosen)) for (const [dep, range] of Object.entries(REGISTRY[pkg][v])) assert.ok(satisfies(r.chosen[dep], range));
});

test("an impossible combination is reported, not hidden", () => {
  const r = resolve({ log: "^1.0.0", auth: "^1.0.0" }, REGISTRY);
  assert.equal(r.ok, false); assert.match(r.conflict, /http/);
});

test("nested installs never conflict, but duplicate packages", () => {
  const n = nested({ log: "^1.0.0", auth: "^1.0.0" }, REGISTRY);
  assert.deepEqual(n.duplicates, ["http: 2.4.1, 3.1.0"]);
});

test("a lockfile keeps you on known versions when a new release appears", () => {
  const root = { web: "^2.0.0", log: "^1.0.0" }, first = resolve(root, REGISTRY).chosen;
  const reg = withRelease(REGISTRY, "http", "2.5.0"); // a new (maybe broken) patch release
  assert.equal(resolve(root, reg).chosen.http, "2.5.0");
  assert.equal(resolve(root, reg, { lock: first }).chosen.http, "2.4.1");
});
