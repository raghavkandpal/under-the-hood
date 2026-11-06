// Phone sweep: paste into the browser console on the running dev server (npm start → http://localhost:8765/).
// Loads every page in a 360px-wide iframe, in light and dark, and lists any with sideways overflow or script errors.
// Prints [] when every page is clean; uncaught errors also show in the console, tagged with the iframe's URL.
// Not run by npm test: it needs a real browser to lay pages out.
//   await (await import("/scripts/sweep.js")).sweep()
//   await (await import("/scripts/sweep.js")).sweep({ only: ["tls", "dns"] })   → just those explainers
import { CATALOG, hrefOf } from "../catalog.js";

export async function sweep({ width = 360, themes = ["light", "dark"], only } = {}) {
  const pages = only ? CATALOG.filter(c => only.includes(c.id)).map(hrefOf) : ["", "path/", "path/?id=llms", ...CATALOG.map(hrefOf)], problems = [];
  const saved = localStorage.getItem("uth.theme");
  for (const theme of themes) {
    localStorage.setItem("uth.theme", theme);
    for (const p of pages) {
      const f = Object.assign(document.createElement("iframe"), { style: `width:${width}px;height:700px;border:0;position:fixed;left:-9999px` });
      const errors = [];
      document.body.append(f);
      await new Promise(res => {
        f.onload = () => setTimeout(res, 600); // let module scripts and first renders run
        f.src = new URL(p, new URL("../", import.meta.url)).href;
      });
      const w = f.contentWindow, d = f.contentDocument;
      const over = d.documentElement.scrollWidth - w.innerWidth;
      if (!d.querySelector("header.site")) errors.push("chrome() did not run");
      if (over > 0 || errors.length) problems.push({ page: p || "/", theme, overflowPx: over, errors });
      f.remove();
    }
  }
  saved == null ? localStorage.removeItem("uth.theme") : localStorage.setItem("uth.theme", saved);
  return problems;
}
