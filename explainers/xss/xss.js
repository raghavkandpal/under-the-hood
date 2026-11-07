// Cross-site scripting: user text pasted into HTML. What each defence produces, and a static check of whether the
// result would run script. Nothing here is ever inserted into a page. No DOM.

export const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Where the comment ends up in the page. */
export const CONTEXTS = {
  body: { name: "Text", template: x => `<p>${x}</p>` },
  attr: { name: "Attribute", template: x => `<img src="avatar.png" alt=${x}>`, quoted: x => `<img src="avatar.png" alt="${x}">` },
  url: { name: "Link", template: x => `<a href="${x}">my site</a>` },
};
export const PAYLOADS = {
  plain: "Tom & Jerry <3",
  script: "<script>alert(1)</script>",
  handler: "x onmouseover=alert(1)",
  quote: "\" onmouseover=\"alert(1)",
  jsurl: "javascript:alert(1)",
};

/** none: paste as is. escape: HTML-escape. context: escape, quote attributes, and allow only http(s) links. */
export function render(ctx, input, defence) {
  const C = CONTEXTS[ctx];
  if (defence === "none") return C.template(input);
  if (defence === "escape") return C.template(escapeHtml(input));
  if (ctx === "attr") return C.quoted(escapeHtml(input));
  if (ctx === "url") return C.template(/^https?:\/\//i.test(input.trim()) ? escapeHtml(input) : "#");
  return C.template(escapeHtml(input));
}

/** Would a browser run script from this HTML? A script tag, an on… event attribute, or a javascript: URL. */
export function runs(html) {
  for (const [, tag, attrs] of html.matchAll(/<([a-z]+)\b([^>]*)>/gi)) {
    if (tag.toLowerCase() === "script") return "a <script> element";
    for (const [, name, raw = ""] of attrs.matchAll(/([^\s="'>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const value = raw.replace(/^["']|["']$/g, "");
      if (/^on/i.test(name)) return `an ${name.toLowerCase()} handler`;
      if (/^(href|src)$/i.test(name) && /^\s*javascript:/i.test(value)) return "a javascript: link";
    }
  }
  return null;
}
