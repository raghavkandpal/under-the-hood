// Dependency resolution: semver ranges, a backtracking resolver (one version per package), nested installs, lockfiles. No DOM.

export const parse = v => v.split(".").map(Number);
export const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

/** Does version v satisfy range r? Supports ^1.2.3, ~1.2.3, >=1.2.3, 1.2.3 and *. */
export function satisfies(v, r) {
  if (r === "*") return true;
  const [M, m, p] = parse(v);
  if (r.startsWith("^")) { const [a, b, c] = parse(r.slice(1)); return cmp(v, `${a}.${b}.${c}`) >= 0 && (a > 0 ? M === a : m === b); }
  if (r.startsWith("~")) { const [a, b, c] = parse(r.slice(1)); return M === a && m === b && p >= c; }
  if (r.startsWith(">=")) return cmp(v, r.slice(2)) >= 0;
  return cmp(v, r) === 0;
}

/**
 * Pick one version of every package so all ranges are satisfied. Tries newest first; on a clash it backtracks.
 * registry: { pkg: { "1.2.0": { dep: "^1.0.0" }, ... } }. lock: optional { pkg: version } preferred when still allowed.
 * Returns { ok, chosen, log, tries, backtracks, conflict? }.
 */
export function resolve(rootDeps, registry, { lock = null, maxTries = 5000 } = {}) {
  const log = []; let tries = 0, backtracks = 0;
  const candidates = (pkg, ranges) => Object.keys(registry[pkg] || {}).filter(v => ranges.every(r => satisfies(v, r)))
    .sort((a, b) => (lock && lock[pkg] === a ? -1 : lock && lock[pkg] === b ? 1 : cmp(b, a)));
  let lastConflict = null;
  function solve(chosen, wants) {
    // wants: list of { pkg, range, from }. Find the first package with constraints but no version yet, or a broken choice.
    for (const w of wants) if (chosen[w.pkg] && !satisfies(chosen[w.pkg], w.range)) { lastConflict = `${w.from} needs ${w.pkg} ${w.range}, but ${w.pkg} ${chosen[w.pkg]} was already chosen`; log.push({ t: "fail", text: lastConflict }); return null; }
    const open = wants.find(w => !chosen[w.pkg]);
    if (!open) return chosen;
    const ranges = wants.filter(w => w.pkg === open.pkg).map(w => w.range), cands = candidates(open.pkg, ranges);
    if (!cands.length) { lastConflict = `no version of ${open.pkg} satisfies ${[...new Set(ranges)].join(" and ")} (wanted by ${[...new Set(wants.filter(w => w.pkg === open.pkg).map(w => w.from))].join(", ")})`; log.push({ t: "fail", text: lastConflict }); return null; }
    for (const v of cands) {
      if (++tries > maxTries) return null;
      log.push({ t: "try", text: `try ${open.pkg} ${v}${lock && lock[open.pkg] === v ? " (locked)" : ""}`, depth: Object.keys(chosen).length });
      const deps = Object.entries(registry[open.pkg][v]).map(([pkg, range]) => ({ pkg, range, from: `${open.pkg} ${v}` }));
      const r = solve({ ...chosen, [open.pkg]: v }, [...wants, ...deps]);
      if (r) return r;
      backtracks++; log.push({ t: "back", text: `↩ undo ${open.pkg} ${v}`, depth: Object.keys(chosen).length });
    }
    return null;
  }
  const root = Object.entries(rootDeps).map(([pkg, range]) => ({ pkg, range, from: "your app" }));
  const chosen = solve({}, root);
  return chosen ? { ok: true, chosen, log, tries, backtracks } : { ok: false, chosen: null, log, tries, backtracks, conflict: lastConflict };
}

/** npm-style: every dependency gets the newest version matching its own range, nested under whoever asked. Never conflicts; may duplicate. */
export function nested(rootDeps, registry) {
  const tree = [], copies = {};
  const add = (deps, depth, path) => Object.entries(deps).forEach(([pkg, range]) => {
    const v = Object.keys(registry[pkg] || {}).filter(x => satisfies(x, range)).sort((a, b) => cmp(b, a))[0];
    tree.push({ pkg, v, depth, range }); (copies[pkg] ||= new Set()).add(v);
    if (v && !path.includes(pkg)) add(registry[pkg][v], depth + 1, [...path, pkg]);
  });
  add(rootDeps, 0, []);
  return { tree, duplicates: Object.entries(copies).filter(([, s]) => s.size > 1).map(([p, s]) => `${p}: ${[...s].join(", ")}`) };
}

/** A made-up registry with a diamond: the newest web framework needs a newer http library than the logger allows. */
export const REGISTRY = {
  web: { "2.0.0": { http: "^2.0.0", router: "^1.0.0" }, "2.1.0": { http: "^3.0.0", router: "^1.2.0" } },
  log: { "1.0.0": { http: "^2.0.0" }, "1.4.0": { http: "^2.1.0" } },
  auth: { "1.0.0": { http: "^3.0.0" } },
  http: { "2.0.0": {}, "2.1.0": {}, "2.4.1": {}, "3.0.0": {}, "3.1.0": {} },
  router: { "1.0.0": {}, "1.2.0": {}, "1.3.0": {} },
};
/** The same registry after a buggy release lands. */
export const withRelease = (reg, pkg, v, deps = {}) => ({ ...reg, [pkg]: { ...reg[pkg], [v]: deps } });
