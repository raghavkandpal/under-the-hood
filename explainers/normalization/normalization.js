// Normalisation: store each fact once. The same three edits on one wide table and on three linked tables. No DOM.

/** Made-up shop orders, one wide row per order: customer and product facts are copied into every row. */
export const WIDE = [
  { order: 1001, customer: "Ada", email: "ada@example.com", city: "Leeds", product: "Keyboard", price: 45, qty: 1 },
  { order: 1002, customer: "Ben", email: "ben@example.com", city: "Cork", product: "Mouse", price: 20, qty: 2 },
  { order: 1003, customer: "Ada", email: "ada@example.com", city: "Leeds", product: "Monitor", price: 180, qty: 1 },
  { order: 1004, customer: "Dara", email: "dara@example.com", city: "Oslo", product: "Keyboard", price: 45, qty: 1 },
  { order: 1005, customer: "Ben", email: "ben@example.com", city: "Cork", product: "Keyboard", price: 45, qty: 1 },
  { order: 1006, customer: "Ada", email: "ada@example.com", city: "Leeds", product: "Mouse", price: 20, qty: 3 },
];
export const COLUMNS = Object.keys(WIDE[0]);

/** Split the wide rows into customers, products and orders that point at them by id. */
export function normalise(wide) {
  const customers = [], products = [], idOf = (list, key, make) => (list.find(x => x.name === key) ?? (list.push(make(list.length + 1)), list.at(-1))).id;
  const orders = wide.map(r => ({ order: r.order,
    customer_id: idOf(customers, r.customer, id => ({ id, name: r.customer, email: r.email, city: r.city })),
    product_id: idOf(products, r.product, id => ({ id, name: r.product, price: r.price })), qty: r.qty }));
  return { customers, products, orders };
}
/** The wide view back again: orders JOIN customers JOIN products. */
export function join({ customers, products, orders }) {
  return orders.map(o => { const c = customers.find(x => x.id === o.customer_id), p = products.find(x => x.id === o.product_id);
    return { order: o.order, customer: c.name, email: c.email, city: c.city, product: p.name, price: p.price, qty: o.qty }; });
}

const clone = x => structuredClone(x);
export const initial = mode => (mode === "wide" ? { wide: clone(WIDE) } : normalise(WIDE));
export const view = db => db.wide ?? join(db);
/** Every customer the database still knows about, orders or not. */
export const customers = db => (db.wide ? [...new Set(db.wide.map(r => r.customer))] : db.customers.map(c => c.name));

/**
 * The three classic anomalies. Each returns { db, written, error? } and never mutates its input.
 * editEmail: the app edits the email on one order's form (a single UPDATE … WHERE order = n).
 */
export const ACTIONS = {
  editEmail(db, order = 1003, email = "ada@newmail.com") {
    db = clone(db);
    if (db.wide) { db.wide.find(r => r.order === order).email = email; return { db, written: 1 }; }
    const o = db.orders.find(r => r.order === order); db.customers.find(c => c.id === o.customer_id).email = email; return { db, written: 1 };
  },
  deleteOrder(db, order = 1004) {
    db = clone(db);
    if (db.wide) db.wide = db.wide.filter(r => r.order !== order); else db.orders = db.orders.filter(r => r.order !== order);
    return { db, written: 1 };
  },
  addCustomer(db, c = { name: "Grace", email: "grace@example.com", city: "Lyon" }) {
    db = clone(db);
    if (db.wide) return { db, written: 0, error: "every row is an order: no order, no row" };
    db.customers.push({ id: db.customers.length + 1, ...c }); return { db, written: 1 };
  },
};

/** Problems a reader can see: customers with conflicting emails. */
export const conflicts = db => customers(db).filter(n => new Set(view(db).filter(r => r.customer === n).map(r => r.email)).size > 1);
/** Values stored: one per cell across every table. */
export const cells = db => (db.wide ? db.wide.length * COLUMNS.length : Object.values(db).reduce((s, t) => s + t.length * Object.keys(t[0] ?? {}).length, 0));
