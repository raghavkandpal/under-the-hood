// Row stores vs column stores: bytes read per query, and per-column compression. No DOM.
// Synthetic "orders" table. Each column has a fixed width in bytes.

export const COLUMNS = [
  { name: "order_id", bytes: 8 }, { name: "date", bytes: 4 }, { name: "country", bytes: 2 }, { name: "product", bytes: 4 },
  { name: "quantity", bytes: 2 }, { name: "price", bytes: 4 }, { name: "customer", bytes: 8 }, { name: "notes", bytes: 64 },
];
export const ROW_BYTES = COLUMNS.reduce((s, c) => s + c.bytes, 0);

export function table(n, rnd) {
  const C = ["US", "DE", "IN", "BR", "JP", "GB"], rows = [];
  for (let i = 0; i < n; i++) rows.push({
    order_id: i + 1, date: 20260101 + Math.floor(i * 300 / n), country: C[Math.floor(rnd() ** 2 * C.length)], product: Math.floor(rnd() * 40),
    quantity: 1 + Math.floor(rnd() ** 3 * 5), price: Math.round(5 + rnd() * 95), customer: Math.floor(rnd() * n / 3), notes: rnd() < 0.9 ? "" : "gift wrap",
  });
  return rows;
}

/** Bytes a query must read. Row store: whole rows. Column store: only the columns it touches. */
export function bytesRead(n, cols, layout) {
  if (layout === "row") return n * ROW_BYTES;
  return n * COLUMNS.filter(c => cols.includes(c.name)).reduce((s, c) => s + c.bytes, 0);
}

/** Run-length encode an array: [[value, count], ...]. */
export function rle(xs) { const out = []; for (const x of xs) { const l = out.at(-1); if (l && l[0] === x) l[1]++; else out.push([x, 1]); } return out; }

/** Estimated compressed size of a column: the best of plain, dictionary, or run-length encoding. */
export function compress(values, width) {
  const n = values.length, distinct = new Set(values).size, idBytes = distinct <= 256 ? 1 : distinct <= 65536 ? 2 : 4;
  const plain = n * width, dict = distinct * width + n * idBytes, runs = rle(values).length, rl = runs * (width + 4);
  const best = Math.min(plain, dict, rl);
  return { plain, dict, rle: rl, best, method: best === plain ? "plain" : best === rl ? "run-length" : "dictionary", distinct, runs };
}

/** SELECT country, SUM(price * quantity) GROUP BY country: same answer from either layout. */
export function revenueByCountry(rows) { const m = {}; for (const r of rows) m[r.country] = (m[r.country] || 0) + r.price * r.quantity; return m; }
export function revenueByCountryColumns(cols) { const m = {}, { country, price, quantity } = cols; for (let i = 0; i < country.length; i++) m[country[i]] = (m[country[i]] || 0) + price[i] * quantity[i]; return m; }
export const toColumns = rows => Object.fromEntries(COLUMNS.map(c => [c.name, rows.map(r => r[c.name])]));
