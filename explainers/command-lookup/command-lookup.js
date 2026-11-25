// How the shell finds a command: a toy file system and bash's lookup order, with no DOM.
// All paths are made up for this model. State is a plain object; every function returns new state.

export const CWD = "/home/me/project";
export const DEFAULT_PATH = "/home/me/bin:/usr/local/bin:/usr/bin";
export const FUNCTIONS = ["ls"];
export const BUILTINS = ["cd"];
export const NEW_FILE = "/home/me/bin/python";
// path -> executable bit
export const BASE_FILES = {
  "/home/me/bin/tool": false,
  "/usr/local/bin/python": true,
  "/usr/bin/python": true,
  "/usr/bin/ls": true,
  "/usr/bin/tool": true,
  "/home/me/project/deploy": true,
};

export const newShell = () => ({ path: DEFAULT_PATH, files: { ...BASE_FILES }, hash: {} });

// Assigning PATH empties the hash table (bash does this).
export const setPath = (sh, path) => ({ ...sh, path, hash: {} });
export const hashReset = sh => ({ ...sh, hash: {} });
export const addFile = (sh, file) => ({ ...sh, files: { ...sh.files, [file]: true } });

// An empty PATH entry means the current directory; a relative one is taken from it.
export const pathDirs = path => path.split(":").map(d => d === "" ? CWD : d.startsWith("/") ? d : `${CWD}/${d}`);

const fileState = (sh, f) => !(f in sh.files) ? "missing" : sh.files[f] ? "runs" : "not executable";
const WORD = { missing: "no such file", "not executable": "not executable, skipped", runs: "runs" };
const result = (via, file, status, steps, searched = 0) => ({ via, file, status, steps, searched });

/** Look `name` up without running it. via: function | builtin | hash table | slash | PATH | nowhere. */
export function resolve(sh, name) {
  if (name.includes("/")) {
    const file = name.startsWith("/") ? name : `${CWD}/${name.replace(/^\.\//, "")}`;
    const s = fileState(sh, file), line = `${name} has a slash, so PATH is not searched: ${file} ${WORD[s]}.`;
    return result("slash", s === "missing" ? null : file, s === "runs" ? 0 : s === "missing" ? 127 : 126, [line]);
  }
  if (FUNCTIONS.includes(name)) return result("function", null, 0, [`${name} is a function, so it runs and the search stops.`]);
  const head = [`${name} is not a function.`];
  if (BUILTINS.includes(name)) return result("builtin", null, 0, [...head, `${name} is a builtin, so it runs and the search stops.`]);
  head.push(`${name} is not a builtin.`);
  if (sh.hash[name]) return result("hash table", sh.hash[name], 0, [...head, `${name} is in the hash table: ${sh.hash[name]}.`]);
  head.push(`${name} is not in the hash table.`);
  const steps = [...head];
  let searched = 0, blocked = null;
  for (const [i, dir] of pathDirs(sh.path).entries()) {
    const file = `${dir}/${name}`, s = fileState(sh, file);
    searched++;
    steps.push(`${dir}${sh.path.split(":")[i] === "" ? " (empty entry)" : ""}: ${s === "missing" ? "no " + name : s === "runs" ? "runs" : WORD[s]}.`);
    if (s === "runs") return result("PATH", file, 0, steps, searched);
    if (s === "not executable") blocked ||= file;
  }
  // exec(3): a file that gave permission denied is reported only if nothing else ran.
  steps.push(blocked ? `Nothing runs: ${blocked} gave permission denied (status 126).` : `${name}: command not found (status 127).`);
  return result("nowhere", blocked, blocked ? 126 : 127, steps, searched);
}

/** Run `name`: a successful PATH search is remembered in the hash table. */
export function run(sh, name) {
  const r = resolve(sh, name);
  return { sh: r.via === "PATH" ? { ...sh, hash: { ...sh.hash, [name]: r.file } } : sh, ...r };
}

export const hashRows = sh => Object.entries(sh.hash).map(([n, f]) => `${n} → ${f}`);
export const fileRows = sh => Object.entries(sh.files).map(([f, x]) => `${f} ${x ? "x" : "–"}`);

export const PATH_PRESETS = { Default: DEFAULT_PATH, "/usr/bin first": "/usr/bin:/home/me/bin:/usr/local/bin", "Trailing colon": "/usr/bin:" };
export const COMMANDS = ["python", "ls", "cd", "deploy", "./deploy", "tool"];

/** The four stat tiles for a lookup of `name`. */
export const tiles = (name, r) => [
  [r.via, "found by"],
  [r.file ?? (r.via === "function" || r.via === "builtin" ? `${name} (${r.via})` : "–"), r.status === 126 ? "refused" : "runs"],
  [r.searched, "directories searched"],
  [r.status, "exit status"],
];
