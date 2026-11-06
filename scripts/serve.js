// Local dev server: serves the repo as static files and tells the browser never to cache them,
// so a normal reload always shows your latest edits. No dependencies.
//   npm start            → http://localhost:8765
//   PORT=9000 npm start  → another port
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 8765;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || file.slice(ROOT.length).split(sep).some(p => p.startsWith(".") && p !== ".")) { res.writeHead(403).end("forbidden"); return; } // stay inside the repo, no dotfiles
  try {
    const s = await stat(file);
    if (s.isDirectory()) {
      if (!path.endsWith("/")) { res.writeHead(301, { location: path + "/" }).end(); return; } // so relative links resolve inside the folder
      file = join(file, "index.html");
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }).end(`not found: ${path}`);
  }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT} (no caching, so a reload shows your edits)`));
