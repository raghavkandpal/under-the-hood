// Full-text search: an inverted index maps each word to the documents (and positions) where it appears. No DOM.

/** Short made-up help-centre articles. */
export const DOCS = [
  "Reset your password from the login page if you forget it",
  "Two factor codes protect your account even if your password leaks",
  "Export your data as a spreadsheet from the account page",
  "The login page shows an error when the password is wrong",
  "Delete your account and all of your data from settings",
  "Change the email address on your account from settings",
  "Payments fail when the card has expired or the address is wrong",
  "Download an invoice for any payment from the billing page",
];

export const tokens = text => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** term → [{ doc, positions }] sorted by doc id. */
export function build(docs) {
  const index = new Map();
  docs.forEach((d, doc) => tokens(d).forEach((t, pos) => {
    if (!index.has(t)) index.set(t, []);
    const list = index.get(t), last = list.at(-1);
    if (last?.doc === doc) last.positions.push(pos); else list.push({ doc, positions: [pos] });
  }));
  return index;
}

/** Intersect sorted posting lists by walking them together. Returns the docs in all of them and how many comparisons it took. */
export function intersect(lists) {
  if (!lists.length) return { docs: [], comparisons: 0 };
  let cur = lists[0].map(p => p.doc), comparisons = 0;
  for (const l of lists.slice(1)) {
    const next = []; let i = 0, j = 0;
    while (i < cur.length && j < l.length) { comparisons++; if (cur[i] === l[j].doc) { next.push(cur[i]); i++; j++; } else if (cur[i] < l[j].doc) i++; else j++; }
    cur = next;
  }
  return { docs: cur, comparisons };
}

/** Docs where the words appear next to each other, in order. */
export function phrase(index, words) {
  const lists = words.map(w => index.get(w) ?? []), { docs } = intersect(lists);
  return docs.filter(d => lists[0].find(p => p.doc === d).positions.some(start => words.every((_, k) => lists[k].find(p => p.doc === d).positions.includes(start + k))));
}

/** tf-idf: a word counts for more the more often it appears in this doc, and the rarer it is across all docs. */
export function score(index, words, doc, n) {
  return words.reduce((s, w) => { const list = index.get(w) ?? [], p = list.find(x => x.doc === doc); return s + (p ? p.positions.length * Math.log(n / list.length) : 0); }, 0);
}

export function search(index, query, n) {
  const quoted = /^".*"$/.test(query.trim()), words = tokens(query);
  const docs = quoted ? phrase(index, words) : intersect(words.map(w => index.get(w) ?? [])).docs;
  return docs.map(doc => ({ doc, score: score(index, words, doc, n) })).sort((a, b) => b.score - a.score || a.doc - b.doc);
}
