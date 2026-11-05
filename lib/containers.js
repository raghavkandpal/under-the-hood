// Container images as cached layers: each layer's ID chains its parent, its instruction and the files it copies. No DOM.

const fnv = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

/** The files that COPY sees. `which` is a list of paths, or ["."] for everything. */
const copied = (which, files) => (which.includes(".") ? Object.keys(files).sort() : which.filter(f => f in files));

/** Layer ID = hash(parent ID, instruction, contents of any files it copies). */
export function layerIds(steps, files) {
  let parent = ""; return steps.map(s => {
    const content = s.op === "COPY" ? copied(s.files, files).map(f => f + ":" + fnv(files[f])).join(",") : "";
    parent = fnv(parent + "|" + s.op + " " + (s.arg || s.files?.join(" ") || "") + "|" + content); return parent;
  });
}

/** Build with a cache of known layer IDs. Docker stops using the cache at the first miss: everything after rebuilds. */
export function build(steps, files, cache = new Set()) {
  const ids = layerIds(steps, files); let missed = false;
  const layers = steps.map((s, i) => { if (!cache.has(ids[i])) missed = true; const hit = !missed; return { ...s, id: ids[i], cached: hit, time: hit ? 0 : s.time || 0.2, size: s.size || 0 }; });
  return { layers, time: layers.reduce((t, l) => t + l.time, 0), cache: new Set([...cache, ...ids]) };
}

/** Disk used by several images, counting shared layers once. */
export function diskUsage(images) { const seen = new Map(); for (const im of images) for (const l of im.layers) seen.set(l.id, l.size); return [...seen.values()].reduce((a, b) => a + b, 0); }
export const imageSize = im => im.layers.reduce((a, l) => a + l.size, 0);

export const FILES = {
  "package.json": '{ "name": "shop", "dependencies": { "express": "^5" } }',
  "package-lock.json": "lockfile v3 …",
  "src/server.js": "app.listen(3000)",
  "src/routes.js": "export const routes = []",
  "README.md": "# Shop",
};

/** Two Dockerfiles for the same app: the only difference is the order of the steps. */
export const DOCKERFILES = {
  bad: [
    { op: "FROM", arg: "node:22-slim", time: 0, size: 220 },
    { op: "WORKDIR", arg: "/app", time: 0.1, size: 0 },
    { op: "COPY", files: ["."], time: 0.5, size: 1 },
    { op: "RUN", arg: "npm ci", time: 45, size: 160 },
    { op: "RUN", arg: "npm run build", time: 12, size: 4 },
  ],
  good: [
    { op: "FROM", arg: "node:22-slim", time: 0, size: 220 },
    { op: "WORKDIR", arg: "/app", time: 0.1, size: 0 },
    { op: "COPY", files: ["package.json", "package-lock.json"], time: 0.2, size: 0.1 },
    { op: "RUN", arg: "npm ci", time: 45, size: 160 },
    { op: "COPY", files: ["."], time: 0.5, size: 1 },
    { op: "RUN", arg: "npm run build", time: 12, size: 4 },
  ],
};

/** A process inside a memory-limited container: the kernel kills it the moment usage crosses the cgroup limit. */
export function runWithLimit(usage, limit) { const t = usage.findIndex(u => u > limit); return t < 0 ? { killed: false } : { killed: true, at: t }; }
