import { test } from "node:test";
import assert from "node:assert/strict";
import { SOURCES, KINDS, TRUSTED } from "../sources.js";
import { CATALOG } from "../catalog.js";

// Long-standing, trusted sources that are only served over plain http.
const HTTP_ONLY = new Set(["ilpubs.stanford.edu", "neuralnetworksanddeeplearning.com", "incompleteideas.net", "www.xmailserver.org"]);
const trusted = host => TRUSTED.some(d => host === d || host.endsWith("." + d));

test("every explainer has at least two sources, and every source list belongs to an explainer", () => {
  for (const c of CATALOG) assert.ok((SOURCES[c.id] || []).length >= 2, `${c.id}: needs at least 2 further-reading sources`);
  for (const id of Object.keys(SOURCES)) assert.ok(CATALOG.some(c => c.id === id), `sources for unknown explainer ${id}`);
});

test("sources are well-formed, from trusted domains, and not repeated within a page", () => {
  for (const [id, list] of Object.entries(SOURCES)) {
    assert.equal(new Set(list.map(s => s[1])).size, list.length, `${id}: duplicate URL`);
    for (const [title, url, kind, by] of list) {
      assert.ok(title && by, `${id}: missing title or publisher for ${url}`);
      assert.ok(KINDS[kind], `${id}: unknown kind "${kind}"`);
      const u = new URL(url);
      assert.ok(u.protocol === "https:" || (u.protocol === "http:" && HTTP_ONLY.has(u.hostname)), `${id}: use https for ${url}`);
      assert.ok(trusted(u.hostname), `${id}: ${u.hostname} isn't in the TRUSTED list in sources.js`);
    }
  }
});

test("each page leads with something deeper than an encyclopedia", () => {
  for (const [id, list] of Object.entries(SOURCES)) {
    assert.ok(list.some(s => s[2] !== "encyclopedia"), `${id}: add a standard, paper, book, docs or article`);
  }
});
