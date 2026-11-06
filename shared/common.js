// Shared header/footer + tiny helpers for every explainer page.
import { CATALOG, AREAS, PATHS, byId, hrefOf, unlocks, areaOf, topicOf, pathById, pathsWith } from "../catalog.js";
import { SOURCES, KINDS } from "../sources.js";

// ---- reading progress: which explainers this browser has opened (a per-viewer convenience; never required)
const READ_KEY = "uth.read";
export function readSet() { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch { return new Set(); } }
export function markRead(id) { try { const s = readSet(); s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch { /* storage unavailable: progress just isn't remembered */ } }
/** First step of a path not yet read (or the first step if all are). */
export const nextStep = (path, read = readSet()) => path.steps.find(id => !read.has(id)) ?? path.steps[0];

/** The site root, worked out from where this file lives (shared/), so links work from any page depth and any host path. */
export const ROOT = new URL("../", import.meta.url);
/** Absolute link to an explainer (or the home page with no argument). */
export const linkTo = c => new URL(c ? hrefOf(c) : "./", ROOT).href;
/** Link to a learning path's introduction page (or the list of all paths). */
export const pathLink = p => new URL(p ? `path/?id=${p.id}` : "path/", ROOT).href;

// ---- theme: "auto" follows the system; "light" or "dark" is the reader's choice (applied early by shared/theme.js)
const THEME_KEY = "uth.theme", systemDark = matchMedia("(prefers-color-scheme: dark)");
export function themePref() { const t = document.documentElement.dataset.theme; return t === "light" || t === "dark" ? t : "auto"; }
/** Is the page showing dark colours right now? Canvas code should ask this, not the system setting. */
export const isDark = () => (themePref() === "auto" ? systemDark.matches : themePref() === "dark");
/** Run `fn` whenever the colours change: the toggle, or the system theme while on auto. Redraw canvases here. */
export const onThemeChange = fn => addEventListener("themechange", fn);
export function setTheme(pref) {
  if (pref === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = pref;
  try { pref === "auto" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, pref); } catch { /* not remembered, still applied */ }
  dispatchEvent(new Event("themechange"));
}
systemDark.addEventListener("change", () => { if (themePref() === "auto") dispatchEvent(new Event("themechange")); });
// Two states for the reader: light or dark. Until they choose, the page follows the system ("auto" internally).

export function chrome() {
  // pages live at explainers/<id>/ (or explainers/<id>/index.html)
  const m = location.pathname.match(/\/explainers\/([^/]+)\/(?:index\.html)?$/);
  const page = m ? byId(m[1]) : null;
  const header = document.createElement("header");
  header.className = "site";
  const area = page && areaOf(page), topic = page && topicOf(page);
  header.innerHTML = `<div class="inner">
    <a class="brand" href="${linkTo()}">How it <span>works</span></a>
    <nav aria-label="Site">
      ${page ? `<span class="crumb" aria-label="Breadcrumb"><a href="${linkTo()}?area=${area.id}">${area.title}</a> › <a href="${linkTo()}?area=${area.id}#topic-${topic.id}">${topic.title}</a></span>` : ""}
      <a class="all" href="${linkTo()}"${page ? "" : ' aria-current="page"'}>All explainers (${CATALOG.length})</a>
      <button type="button" class="browse" aria-controls="sidenav" aria-expanded="false">☰ Browse</button>
      <button type="button" class="theme-toggle"></button>
    </nav>
  </div>`;
  document.body.prepend(header);
  const toggle = header.querySelector(".theme-toggle");
  // the button names the theme it switches to
  const label = () => { const next = isDark() ? "light" : "dark"; toggle.textContent = next === "dark" ? "☾ Dark" : "☀ Light"; toggle.setAttribute("aria-label", `Switch to ${next} theme`); };
  toggle.onclick = () => setTheme(isDark() ? "light" : "dark");
  onThemeChange(label); // also relabel if the system theme changes before the reader has chosen
  label();

  const main = document.querySelector("main");
  let endLink = null;
  if (page && main) {
    markRead(page.id);
    // ---- learning path navigation: the ?path= the reader arrived with, if this page is on it
    const path = pathById(new URLSearchParams(location.search).get("path"));
    const onPath = path && path.steps.includes(page.id) ? path : null;
    const stepLink = (p, id) => `${linkTo(byId(id))}?path=${p.id}`;
    if (onPath) {
      const i = onPath.steps.indexOf(page.id), prev = onPath.steps[i - 1], next = onPath.steps[i + 1];
      const bar = document.createElement("nav");
      bar.className = "pathbar"; bar.setAttribute("aria-label", "Learning path");
      bar.innerHTML = `<a class="pathname" href="${pathLink(onPath)}">${onPath.title}</a><span class="pathpos">Part ${i + 1} of ${onPath.steps.length}</span>
        <span class="pathdots">${onPath.steps.map((id, j) => { const state = j === i ? "here" : readSet().has(id) ? "read" : ""; const label = `Part ${j + 1}: ${byId(id).title}${state === "here" ? " (you are here)" : state === "read" ? " (read)" : ""}`;
          return `<a href="${stepLink(onPath, id)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" class="${state}"${state === "here" ? ' aria-current="step"' : ""}></a>`; }).join("")}</span>
        <span class="pathlinks">${prev ? `<a href="${stepLink(onPath, prev)}">← ${byId(prev).title}</a>` : ""}${next ? `<a href="${stepLink(onPath, next)}">Next: ${byId(next).title} →</a>` : `<a href="${pathLink(onPath)}">Path complete ✓</a>`}</span>`;
      (main.querySelector("p.lede") || main.querySelector("h1")).after(bar);
      const end = document.createElement("a");
      end.className = "pathnext";
      end.href = next ? stepLink(onPath, next) : pathLink(onPath);
      end.innerHTML = next ? `<small>${onPath.title} · Part ${i + 2} of ${onPath.steps.length}</small>Next: ${byId(next).title} →` : `<small>${onPath.title}</small>You've reached the end of this path ✓`;
      endLink = end;
    } else if (pathsWith(page.id).length) {
      const note = document.createElement("p");
      note.className = "status pathsof";
      note.innerHTML = `Part of the learning path${pathsWith(page.id).length > 1 ? "s" : ""}: ${pathsWith(page.id).map(p => `<a href="${stepLink(p, page.id)}">${p.title}</a>`).join(", ")}`;
      (main.querySelector("p.lede") || main.querySelector("h1")).after(note);
    }
    // ---- further reading: trusted, free sources (sources.js)
    const reading = SOURCES[page.id] || [];
    if (reading.length) {
      const sec = document.createElement("section");
      sec.className = "reading";
      sec.innerHTML = `<h2>Further reading</h2><ul>${reading.map(([title, url, kind, by]) =>
        `<li><a href="${url}" target="_blank" rel="noopener">${escapeHtml(title)}</a><span class="src"><span class="kind kind-${kind}">${KINDS[kind]}</span>${escapeHtml(by)}</span></li>`).join("")}</ul>
        <p class="status">All free to read. Standards and papers are the primary sources; the rest explain the same ideas another way.</p>`;
      main.append(sec);
    }
    // ---- keep exploring: prerequisites, what builds on this, then the rest of its topic
    const rel = [...page.prereqs.map(byId).filter(Boolean).map(c => ["Builds on", c]), ...unlocks(page.id).map(c => ["Next", c])];
    const same = CATALOG.filter(c => c.area === page.area && c.topic === page.topic && c.id !== page.id && !rel.some(([, r]) => r.id === c.id)).slice(0, 3).map(c => ["Same topic", c]);
    const all = [...rel, ...same];
    if (all.length) {
      const sec = document.createElement("section");
      sec.className = "related";
      sec.innerHTML = `<h2>Keep exploring</h2><div class="cards">${all.map(([why, c]) => `
        <a class="card" href="${linkTo(c)}"><div class="tag">${why}</div><h3>${c.title}</h3><p>${c.blurb}</p></a>`).join("")}</div>`;
      main.append(sec);
    }
  }
  // the path's big "Next" link goes last, after everything else on the page
  if (endLink) main.append(endLink);
  const footer = document.createElement("footer");
  footer.className = "site";
  footer.textContent = "Interactive explainers · everything runs in your browser";
  document.body.append(footer);
  if (main) sidebar(page, main, header);
}

// ---- sidebar: where am I, what's next, what's on this page. A sticky column on wide screens, a drawer on narrow ones.
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function sidebar(page, main, header) {
  const params = new URLSearchParams(location.search), onPathPage = /\/path\/(index\.html)?$/.test(location.pathname);
  const path = pathById(onPathPage ? params.get("id") : params.get("path")), read = readSet();
  const here = page?.id;
  const link = (href, text, current, extra = "", kind = "page") => `<li${extra}><a href="${href}"${current ? ` aria-current="${kind}"` : ""}>${escapeHtml(text)}</a></li>`;
  const parts = [];
  if (path && (onPathPage || path.steps.includes(here))) {
    parts.push(`<section><h2><a href="${pathLink(path)}">${escapeHtml(path.title)}</a></h2><ol class="side-steps">${path.steps.map(id => {
      const c = byId(id); return link(`${linkTo(c)}?path=${path.id}`, c.title, id === here, read.has(id) ? ' class="read"' : "", "step"); }).join("")}</ol></section>`);
  }
  if (page) {
    const area = areaOf(page);
    parts.push(`<section><h2><a href="${linkTo()}?area=${area.id}">${escapeHtml(area.title)}</a></h2>${area.topics.map(t => {
      const items = CATALOG.filter(c => c.area === area.id && c.topic === t.id);
      return `<h3>${escapeHtml(t.title)}</h3><ul>${items.map(c => link(linkTo(c), c.title, c.id === here, read.has(c.id) ? ' class="read"' : "")).join("")}</ul>`; }).join("")}</section>`);
  } else {
    parts.push(`<section><h2>Areas</h2><ul>${AREAS.map(a => link(`${linkTo()}?area=${a.id}`, a.title, false)).join("")}</ul></section>`);
  }
  // on this page: the h2 sections, given ids if they lack them
  const heads = [...main.querySelectorAll("h2")].filter(h => !h.closest("nav, aside") && h.textContent.trim());
  const used = new Set();
  for (const h of heads) { if (!h.id) { let id = slug(h.textContent) || "section", k = id, n = 2; while (used.has(k) || document.getElementById(k)) k = `${id}-${n++}`; h.id = k; } used.add(h.id); }
  if (heads.length > 1) parts.push(`<section><h2>On this page</h2><ul class="toc">${heads.map(h => `<li><a href="#${h.id}">${escapeHtml(h.textContent.trim())}</a></li>`).join("")}</ul></section>`);
  parts.push(`<section><h2><a href="${pathLink()}">Learning paths</a></h2><ul>${PATHS.map(p => link(pathLink(p), p.title, p === path && onPathPage)).join("")}</ul></section>`);

  const aside = document.createElement("aside");
  aside.id = "sidenav"; aside.className = "sidenav"; aside.setAttribute("aria-label", "Browse explainers");
  aside.innerHTML = `<button type="button" class="side-close" aria-label="Close navigation">✕</button>${parts.join("")}`;
  const backdrop = document.createElement("div"); backdrop.className = "side-backdrop";
  header.after(aside, backdrop);
  document.body.classList.add("with-side");
  // bring the current entry into view inside the sidebar only (scrollIntoView would also scroll the page)
  const cur = aside.querySelector("[aria-current]");
  if (cur) requestAnimationFrame(() => { aside.scrollTop = Math.max(0, cur.offsetTop - aside.clientHeight / 3); });

  // narrow screens: the sidebar is a drawer behind the Browse button
  const btn = header.querySelector(".browse"), others = () => [...document.body.children].filter(el => el !== aside && el !== backdrop);
  const setOpen = open => {
    document.body.classList.toggle("side-open", open); btn.setAttribute("aria-expanded", String(open));
    others().forEach(el => (open ? el.setAttribute("inert", "") : el.removeAttribute("inert")));
    if (open) (aside.querySelector("[aria-current]") || aside.querySelector("a")).focus(); else btn.focus();
  };
  btn.onclick = () => setOpen(true);
  aside.querySelector(".side-close").onclick = () => setOpen(false);
  backdrop.onclick = () => setOpen(false);
  addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("side-open")) setOpen(false); });
  aside.addEventListener("click", e => { if (e.target.closest("a") && document.body.classList.contains("side-open")) setOpen(false); });
  matchMedia("(min-width: 1180px)").addEventListener("change", e => { if (e.matches && document.body.classList.contains("side-open")) setOpen(false); });

  // highlight the section being read
  const toc = new Map([...aside.querySelectorAll(".toc a")].map(a => [a.getAttribute("href").slice(1), a]));
  if (toc.size && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { toc.forEach(a => a.classList.remove("on")); toc.get(en.target.id)?.classList.add("on"); } }), { rootMargin: "0px 0px -70% 0px" });
    heads.forEach(h => io.observe(h));
  }
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

/** True when the reader has asked the OS for less motion: auto-playing demos should start paused, and steps jump to their end state. */
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Make a drag-only control usable from the keyboard: it joins the tab order and gets a name, and the
 * arrow keys call onNudge(dx, dy, event) with a step of `step` (or `bigStep` with Shift held), in
 * whatever units the page uses. `label` should say what the control is and which keys do what.
 * Works on HTML elements and SVG elements alike. Pages can add their own keydown listener for other keys.
 */
export function keyboardDraggable(el, label, onNudge, { step = 1, bigStep = 10, role = "button" } = {}) {
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", role);
  el.setAttribute("aria-label", label);
  el.addEventListener("keydown", e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const s = e.shiftKey ? bigStep : step;
    onNudge(d[0] * s, d[1] * s, e);
  });
}
