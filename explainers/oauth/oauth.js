// OAuth 2.0 authorization-code flow, simulated as a list of messages, with PKCE, the state parameter and two attacks. No DOM.
// Actors: user (browser), app (the client), auth (authorization server), api (resource server), evil (attacker).

/** Stand-in for SHA-256 (FNV-1a, hex). Real PKCE uses base64url(SHA-256(verifier)). */
export function digest(s) { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }

/**
 * opts: { pkce: bool, state: bool, attack: "none" | "steal-code" | "csrf" }
 * returns { steps: [{ from, to, label, detail, kind }], outcome: { ok, text } }
 * kind: "normal" | "attack" | "blocked" | "secret"
 */
export function run({ pkce = true, state = true, attack = "none" } = {}) {
  const steps = [], add = (from, to, label, detail = "", kind = "normal") => steps.push({ from, to, label, detail, kind });
  const verifier = "v3rifier-k9QpZ2", challenge = digest(verifier), st = "st-7f3a";
  const auth = { codes: new Map() }; // code -> { user, challenge }
  const issue = (user, ch) => { const code = "code-" + digest(user + (ch || "") + auth.codes.size).slice(0, 5); auth.codes.set(code, { user, challenge: ch }); return code; };
  const redeem = (code, ver) => {
    const c = auth.codes.get(code); if (!c) return { error: "invalid_grant: unknown or used code" };
    auth.codes.delete(code); // codes are single-use
    if (c.challenge && (!ver || digest(ver) !== c.challenge)) return { error: "invalid_grant: code_verifier doesn't match the challenge" };
    return { token: "tok-" + c.user };
  };

  if (attack === "csrf") {
    // The attacker gets a code for THEIR OWN account, then tricks the victim's browser into delivering it to the app.
    const evilCode = issue("mallory", null);
    add("evil", "auth", "logs in as mallory, gets a code", `code=${evilCode}`, "attack");
    add("evil", "user", "sends a link: app/callback?code=…", "the victim clicks it while logged in to the app", "attack");
    add("user", "app", "GET /callback?code=" + evilCode, state ? "no state, or a state that doesn't match the victim's session" : "nothing ties this callback to a login the victim started", "attack");
    if (state) { add("app", "app", "state check fails", "the app never started this login, so it refuses the code", "blocked"); return { steps, outcome: { ok: true, text: "Blocked by state. The callback didn't carry the random value the app saved when the victim began logging in." } }; }
    const r = redeem(evilCode, null);
    add("app", "auth", "POST /token code=" + evilCode, "", "normal"); add("auth", "app", "access_token", r.token, "secret");
    return { steps, outcome: { ok: false, text: "Login CSRF: the victim is now signed in to the app as mallory. Anything they upload or type (a card number, private notes) lands in the attacker's account." } };
  }

  add("user", "app", "clicks “Sign in with Provider”", "");
  add("app", "user", "302 redirect to the provider", [`client_id=app`, `redirect_uri=app/callback`, `scope=photos.read`, state && `state=${st}`, pkce && `code_challenge=${challenge}`].filter(Boolean).join("  "), "normal");
  if (pkce) steps.at(-1).detail += `   (the app keeps verifier=${verifier} secret)`;
  add("user", "auth", "logs in and approves “read your photos”", "the password goes only to the provider, never to the app");
  const code = issue("alice", pkce ? challenge : null);
  add("auth", "user", "302 back to app/callback", `code=${code}` + (state ? `  state=${st}` : ""));

  let stolen = null;
  if (attack === "steal-code") {
    add("evil", "user", "intercepts the redirect", "a malicious app registered the same custom URL scheme, or the code leaked via logs or the Referer header", "attack");
    stolen = code;
    const r = redeem(stolen, null);
    add("evil", "auth", "POST /token code=" + stolen, pkce ? "no code_verifier: the attacker never saw it" : "", "attack");
    if (r.error) { add("auth", "evil", "400 " + r.error, "", "blocked"); return { steps, outcome: { ok: true, text: "Blocked by PKCE. The stolen code is useless without the verifier, which never left the real app." } }; }
    add("auth", "evil", "access_token", r.token, "attack");
    return { steps, outcome: { ok: false, text: "Account takeover: the attacker swapped the stolen code for alice's token and can read her photos. A public client (mobile or single-page app) has no client secret, so only PKCE could have stopped this." } };
  }

  add("user", "app", "GET /callback?code=" + code, state ? "the app checks that state matches the one it saved" : "");
  const r = redeem(code, pkce ? verifier : null);
  add("app", "auth", "POST /token", `code=${code}` + (pkce ? `  code_verifier=${verifier}` : ""), "normal");
  if (pkce) add("auth", "auth", "checks hash(verifier) = challenge", `${digest(verifier)} = ${challenge} ✓`);
  add("auth", "app", "access_token (+ refresh_token)", r.token, "secret");
  add("app", "api", "GET /photos  Authorization: Bearer …", "a short-lived token, limited to photos.read");
  add("api", "app", "200 photos", "");
  return { steps, outcome: { ok: true, text: "Signed in. The app can read alice's photos, and only those, without ever seeing her password." } };
}
