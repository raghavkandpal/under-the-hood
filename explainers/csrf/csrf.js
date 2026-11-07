// Cross-site request forgery: the browser attaches your bank's cookie to requests another site makes.
// A model of which cookies are sent, and what the bank's server accepts under each defence. No DOM.

/** Requests the browser might make to bank.example. `from` is the site that caused the request. */
export const SCENARIOS = {
  legit: { name: "You press Send on the bank", from: "bank.example", method: "POST", topLevel: true, token: true, attack: false },
  emailLink: { name: "You open a link to the bank from email", from: "mail.example", method: "GET", topLevel: true, token: false, attack: false, needsLogin: true },
  form: { name: "Evil site auto-submits a POST form", from: "evil.example", method: "POST", topLevel: true, token: false, attack: true },
  getLink: { name: "Evil site links to a GET that transfers", from: "evil.example", method: "GET", topLevel: true, token: false, attack: true, unsafeGet: true },
  fetch: { name: "Evil site calls fetch() in the background", from: "evil.example", method: "POST", topLevel: false, token: false, attack: true },
};
export const DEFENCES = { none: "None", lax: "SameSite=Lax", strict: "SameSite=Strict", token: "CSRF token" };

const sameSite = s => s.from === "bank.example";
/** Does the browser attach the session cookie? None: always. Lax: same site, or a top-level GET navigation. Strict: same site only. */
export function cookieSent(s, defence) {
  if (defence === "strict") return sameSite(s);
  if (defence === "lax") return sameSite(s) || (s.topLevel && s.method === "GET");
  return true;
}

/** What happens: "transfer" (money moves), "page" (a normal logged-in page), "logged out", or "rejected". */
export function outcome(key, defence) {
  const s = SCENARIOS[key], cookie = cookieSent(s, defence);
  if (!cookie) return "logged out";
  if (defence === "token" && s.method !== "GET" && !s.token) return "rejected";
  if (s.needsLogin) return "page";
  return s.method === "POST" || s.unsafeGet ? "transfer" : "page";
}
/** Good: the attack fails and the legitimate request works as the user expects. */
export const good = (key, defence) => { const s = SCENARIOS[key], o = outcome(key, defence); return s.attack ? o !== "transfer" : s.needsLogin ? o === "page" : o === "transfer"; };
