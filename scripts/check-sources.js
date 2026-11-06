// Fetch every further-reading URL and report any that don't load. Needs network access, so it isn't part of `npm test`.
//   npm run check-sources
import { SOURCES } from "../sources.js";

const all = [...new Map(Object.values(SOURCES).flat().map(([title, url]) => [url, title])).entries()];
const UA = "Mozilla/5.0 (compatible; under-the-hood link check)";
async function check(url) {
  for (const method of ["HEAD", "GET"]) { // some servers reject HEAD, so fall back to GET
    try {
      const r = await fetch(url, { method, redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return { ok: true, status: r.status, final: r.url };
      if (method === "GET") return { ok: false, status: r.status, final: r.url };
    } catch (e) { if (method === "GET") return { ok: false, status: e.name === "TimeoutError" ? "timeout" : e.cause?.code || e.message }; }
  }
}
const bad = [];
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < all.length) { const [url, title] = all[i++]; const r = await check(url); if (!r.ok) bad.push({ url, title, ...r }); }
}));
console.log(`${all.length} unique URLs checked, ${bad.length} failed`);
for (const b of bad) console.log(`  ${b.status}  ${b.url}  (${b.title})`);
process.exitCode = bad.length ? 1 : 0;
