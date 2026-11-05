// Shared header/footer + tiny helpers for every explainer page.
import { CATALOG, AREAS, byId, hrefOf, unlocks } from "../catalog.js";

/** The site root, worked out from where this file lives (shared/), so links work from any page depth and any host path. */
export const ROOT = new URL("../", import.meta.url);
/** Absolute link to an explainer (or the home page with no argument). */
export const linkTo = c => new URL(c ? hrefOf(c) : "./", ROOT).href;

export function chrome() {
  // pages live at explainers/<id>/ (or explainers/<id>/index.html)
  const m = location.pathname.match(/\/explainers\/([^/]+)\/(?:index\.html)?$/);
  const page = m ? byId(m[1]) : null;
  const header = document.createElement("header");
  header.className = "site";
  header.innerHTML = `<div class="inner">
    <a class="brand" href="${linkTo()}">How it <span>works</span></a>
    <nav>
      ${page ? `<a class="crumb" href="${linkTo()}?area=${page.area}">${AREAS.find(a => a.id === page.area)?.title ?? ""}</a>` : ""}
      <a href="${linkTo()}"${page ? "" : ' aria-current="page"'}>All explainers (${CATALOG.length})</a>
    </nav>
  </div>`;
  document.body.prepend(header);

  if (page) {
    const rel = [...page.prereqs.map(byId).filter(Boolean).map(c => ["Builds on", c]), ...unlocks(page.id).map(c => ["Next", c])];
    const same = CATALOG.filter(c => c.area === page.area && c.id !== page.id && !rel.some(([, r]) => r.id === c.id)).slice(0, 3).map(c => ["Same area", c]);
    const all = [...rel, ...same];
    if (all.length) {
      const sec = document.createElement("section");
      sec.className = "related";
      sec.innerHTML = `<h2>Keep exploring</h2><div class="cards">${all.map(([why, c]) => `
        <a class="card" href="${linkTo(c)}"><div class="tag">${why}</div><h3>${c.title}</h3><p>${c.blurb}</p></a>`).join("")}</div>`;
      document.querySelector("main")?.append(sec);
    }
  }
  const footer = document.createElement("footer");
  footer.className = "site";
  footer.textContent = "Interactive explainers · everything runs in your browser";
  document.body.append(footer);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const svgNS = "http://www.w3.org/2000/svg";
export function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** One statistics tile: use as `$("#stats").innerHTML = [[value, label], ...].map(statTile).join("")`. Styles live in style.css (.stats/.stat). */
export const statTile = ([value, label]) => `<div class="stat"><b>${value}</b><small>${label}</small></div>`;

/** Fill a .tabs container with buttons and call onPick(key) on click. options: { key: label }. Returns a setter for the active key. */
export function tabs(el, options, active, onPick) {
  el.innerHTML = Object.entries(options).map(([k, l]) => `<button data-k="${k}" aria-pressed="${k === active}">${l}</button>`).join("");
  const set = k => el.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === k));
  el.onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; set(b.dataset.k); onPick(b.dataset.k); };
  return set;
}
