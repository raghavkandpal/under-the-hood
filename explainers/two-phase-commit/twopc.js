// Two-phase commit, step by step, with injectable failures. No DOM.

/**
 * opts: { n: participants, noVote: index|null (that participant votes NO),
 *         crash: null | "coordinator-before-decision" | "coordinator-after-decision" | "participant-before-vote" }
 * Returns the message sequence and each node's final state.
 */
export function run({ n = 3, noVote = null, crash = null, crashed = 1 } = {}) {
  const P = Array.from({ length: n }, (_, i) => ({ id: i, state: "working", vote: null }));
  const C = { state: "working", decision: null };
  const msgs = [], say = (from, to, label, kind = "msg") => msgs.push({ from, to, label, kind, snapshot: snap() });
  const snap = () => ({ C: { ...C }, P: P.map(p => ({ ...p })) });

  // Phase 1: prepare
  C.state = "preparing";
  for (const p of P) say("C", p.id, "PREPARE");
  for (const p of P) {
    if (crash === "participant-before-vote" && p.id === crashed) { p.state = "crashed"; say(p.id, "C", "(no reply: crashed)", "fail"); continue; }
    p.vote = p.id === noVote ? "no" : "yes";
    p.state = p.vote === "yes" ? "prepared" : "aborted"; // a YES voter has promised it can commit and must wait
    say(p.id, "C", p.vote === "yes" ? "VOTE YES" : "VOTE NO", p.vote === "yes" ? "good" : "bad");
  }
  // Decision
  if (crash === "coordinator-before-decision") {
    C.state = "crashed";
    say("C", "C", "coordinator crashes before announcing a decision", "fail");
    for (const p of P) if (p.state === "prepared") p.state = "blocked";
    return finish();
  }
  const allYes = P.every(p => p.vote === "yes");
  C.decision = allYes ? "commit" : "abort"; C.state = C.decision === "commit" ? "committed" : "aborted";
  say("C", "C", `decision: ${C.decision.toUpperCase()} (written to its log)`, allYes ? "good" : "bad");
  // Phase 2
  for (const p of P) {
    if (crash === "coordinator-after-decision" && p.id > 0) {
      say("C", p.id, "(lost: coordinator crashed mid-broadcast)", "fail");
      if (p.state === "prepared") p.state = "blocked";
      continue;
    }
    if (p.state === "crashed") { say("C", p.id, `${C.decision.toUpperCase()} (undeliverable: crashed)`, "fail"); continue; }
    say("C", p.id, C.decision.toUpperCase(), allYes ? "good" : "bad");
    p.state = C.decision === "commit" ? "committed" : "aborted";
  }
  if (crash === "coordinator-after-decision") C.state = "crashed";
  return finish();

  function finish() {
    const states = P.map(p => p.state);
    const consistent = !(states.includes("committed") && states.includes("aborted"));
    return { msgs, C, P, blocked: states.filter(s => s === "blocked").length, consistent };
  }
}
