// Runs in <head>, before the page paints, so a saved theme never flashes the wrong colours.
// The choice ("light" or "dark"; absent = follow the system) is set by the toggle in shared/common.js.
try { const t = localStorage.getItem("uth.theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch { /* storage blocked: follow the system */ }
