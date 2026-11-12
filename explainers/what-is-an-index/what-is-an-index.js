// What is an index?: a table of people, a sorted index on (last, first), and what each lookup costs. No DOM.
import { mulberry } from "../../shared/random.js";
import { heightFor } from "../../shared/height.js";

export const LAST = ["Adams", "Baker", "Chen", "Diaz", "Evans", "Fox", "Garcia", "Hill", "Ito", "Jones", "Khan", "Lopez", "Mori", "Nash", "Ortiz", "Park", "Quinn", "Reyes", "Singh", "Tran", "Usman", "Vega", "Wong", "Xu", "Young", "Zhou",
  "Abbott", "Brandt", "Cole", "Dunn", "Egan", "Ford", "Gray", "Hale", "Iyer", "Joshi", "Kerr", "Lane", "Moss", "Noor", "Owen", "Pike", "Rao", "Sato", "Todd", "Voss", "Webb", "Yates", "Zane", "Bloom"];
export const FIRST = ["Ana", "Ben", "Cara", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivan", "Jade", "Kai", "Lena", "Max", "Nia", "Omar", "Pia", "Raj", "Sam", "Tia", "Uma", "Val", "Wen", "Yuri", "Zoe",
  "Abe", "Bea", "Cy", "Dana", "Eve", "Finn", "Gita", "Hugo", "Ida", "Joel", "Kit", "Lara", "Milo", "Nell", "Otto", "Remy", "Sara", "Theo", "Una", "Vik", "Will", "Xia", "Yan", "Zed", "Lou", "Rue"];

export const DEFAULTS = { seed: 7, rows: 2000, person: 700, perPage: 100 };

/** n people with ids 1..n; names drawn from the lists above. */
export function makeTable(seed = DEFAULTS.seed, n = DEFAULTS.rows) {
  const rnd = mulberry(seed);
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, last: LAST[Math.floor(rnd() * LAST.length)], first: FIRST[Math.floor(rnd() * FIRST.length)] }));
}

const cmpKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Compare an index entry's key with a (possibly shorter) prefix: only the prefix's columns count. */
const cmpPrefix = (key, prefix) => { for (let i = 0; i < prefix.length; i++) { const c = cmpKey(key[i], prefix[i]); if (c) return c; } return 0; };

/** Binary search: first position whose entry is not below the target, and how many comparisons it took. */
export function lowerBound(entries, cmp) {
  let lo = 0, hi = entries.length, compares = 0;
  while (lo < hi) { const mid = (lo + hi) >> 1; compares++; if (cmp(entries[mid]) < 0) lo = mid + 1; else hi = mid; }
  return { pos: lo, compares };
}

/** A sorted copy of (last, first, id): the index. */
export const buildIndex = rows => rows.map(r => ({ key: [r.last, r.first], id: r.id })).sort((a, b) => cmpPrefix(a.key, b.key) || a.id - b.id);

/** The three query shapes, as the columns they filter on. */
export const SHAPES = { last: ["last"], both: ["last", "first"], first: ["first"] };

/**
 * Answer "filter on these columns" two ways. Without a usable index (the leftmost column
 * must be filtered) it reads every row; with one it binary-searches, then reads the matching entries.
 */
export function lookup(rows, index, filter) {
  const cols = Object.keys(filter);
  if (cols.includes("last")) {
    const prefix = cols.includes("first") ? [filter.last, filter.first] : [filter.last];
    const { pos, compares } = lowerBound(index, e => cmpPrefix(e.key, prefix));
    let end = pos;
    while (end < index.length && cmpPrefix(index[end].key, prefix) === 0) end++;
    return { usedIndex: true, steps: compares + (end - pos), compares, matches: index.slice(pos, end).map(e => e.id) };
  }
  const matches = rows.filter(r => cols.every(c => r[c] === filter[c])).map(r => r.id);
  return { usedIndex: false, steps: rows.length, compares: 0, matches };
}

/** Pages read to find one row among n at perPage rows per page: a scan reads every page; the index walks a tree, then fetches one table page. */
export const scanPages = (n, perPage) => Math.ceil(n / perPage);
export const indexPages = (n, perPage) => heightFor(n, perPage) + 1;

/** Insert a row into the table and, in sorted place, into every index; returns how many structures were written. */
export function insertRow(table, indexes, row) {
  table.push(row);
  const key = [row.last, row.first];
  for (const ix of indexes) ix.splice(lowerBound(ix, e => cmpPrefix(e.key, key) || e.id - row.id).pos, 0, { key, id: row.id });
  return 1 + indexes.length;
}
