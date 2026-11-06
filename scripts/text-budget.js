// Helper-text budget: counts the words of explanatory text around each explainer's controls, so it can
// only go down. The interactive part of a page should explain itself through its layout; prose belongs
// under the "How it works" headings.
//   npm run text-budget            → table of every page, worst first, and the totals
//   npm run text-budget -- --update → write the current counts to tests/text-budget.json (do this when you cut text)
// tests/text-budget.test.js fails if a page goes over its recorded count, or under it without --update.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
export const BASELINE = `${root}tests/text-budget.json`;

const words = html => (html.replace(/<(script|style|select|svg)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&\w+;|\$\{[^}]*\}/g, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'’.,:;%-]*/gu) || []).length;
const sum = (html, re) => [...html.matchAll(re)].reduce((n, m) => n + words(m[1]), 0);

/**
 * Words of helper text in one page's HTML, by kind:
 * - status: static text in .status elements, plus fixed sentences that scripts write into .status elements
 *           (`<span class="status">…</span>` in a template). Live readouts start empty and don't count.
 * - labels: <label> text, minus the control inside it
 * - small:  <small> text
 * - note:   .note boxes
 * - caveat: the simplifications note (.caveat), counted separately: it belongs on every page, but short
 */
export function measure(html) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>")), script = html.slice(html.indexOf("</main>"));
  const status = [...main.matchAll(/<(p|div|span) class="status"[^>]*>([\s\S]*?)<\/\1>/g)].reduce((n, m) => n + words(m[2]), 0)
    + sum(script, /class="status"[^>]*>([^<`]*?)<\//g);
  return { status, labels: sum(main, /<label[^>]*>([\s\S]*?)<\/label>/g), small: sum(main, /<small[^>]*>([\s\S]*?)<\/small>/g),
    note: sum(main, /class="note"[^>]*>([\s\S]*?)<\/(?:p|div)>/g), caveat: sum(main, /<p class="caveat"[^>]*>([\s\S]*?)<\/p>/g) };
}
export const helper = m => m.status + m.labels + m.small + m.note;

export function measureAll() {
  const dir = `${root}explainers/`;
  return Object.fromEntries(readdirSync(dir).filter(d => existsSync(`${dir}${d}/index.html`)).sort()
    .map(d => [d, measure(readFileSync(`${dir}${d}/index.html`, "utf8"))]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = measureAll();
  if (process.argv.includes("--update")) {
    writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(all).map(([id, m]) => [id, { helper: helper(m), caveat: m.caveat }])), null, 0).replace(/\},/g, "},\n") + "\n");
    console.log(`wrote ${BASELINE}`);
  }
  const rows = Object.entries(all).sort((a, b) => helper(b[1]) - helper(a[1]));
  for (const [id, m] of rows) console.log(`${String(helper(m)).padStart(4)}  ${id.padEnd(22)} status ${m.status}, labels ${m.labels}, small ${m.small}, note ${m.note} · caveat ${m.caveat}`);
  const t = k => rows.reduce((n, [, m]) => n + (k ? m[k] : helper(m)), 0);
  console.log(`\nhelper text: ${t()} words (status ${t("status")}, labels ${t("labels")}, small ${t("small")}, note ${t("note")}) · caveats ${t("caveat")} words · ${rows.length} pages`);
}
