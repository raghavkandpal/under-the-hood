import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url), css = readFileSync(new URL("shared/style.css", root), "utf8");
const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

test("the system-dark and chosen-dark token blocks stay identical", () => {
  const auto = css.match(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/)[1], chosen = css.match(/:root\[data-theme="dark"\] \{([^}]*)\}/)[1];
  assert.deepEqual(tokens(chosen), tokens(auto));
  assert.ok(Object.keys(tokens(auto)).length >= 15);
});

test("every page applies the saved theme in <head>, before it paints", () => {
  const pages = ["index.html", "path/index.html", ...readdirSync(new URL("explainers/", root)).map(d => `explainers/${d}/index.html`).filter(p => existsSync(new URL(p, root)))];
  for (const p of pages) {
    const head = readFileSync(new URL(p, root), "utf8").split("</head>")[0];
    assert.match(head, /<script src="(\.\/|\.\.\/|\.\.\/\.\.\/)shared\/theme\.js"><\/script>/, `${p} is missing shared/theme.js in <head>`);
  }
});

test("explainers ask isDark(), not the system setting, so they follow the toggle", () => {
  for (const d of readdirSync(new URL("explainers/", root))) {
    const f = new URL(`explainers/${d}/index.html`, root); if (!existsSync(f)) continue;
    assert.ok(!readFileSync(f, "utf8").includes("prefers-color-scheme"), `${d}: use isDark() / onThemeChange() from shared/common.js`);
  }
});
