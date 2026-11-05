// A compact Raft simulation (leader election + log replication), deterministic per seed. No DOM.
// Times are in simulated milliseconds. Log indices are 1-based, as in the paper.
import { mulberry32 } from "../../shared/tcp.js";

export const CONFIG = { heartbeat: 450, electionMin: 1500, electionMax: 3000, latencyMin: 90, latencyMax: 170, maxBatch: 4 };

export class Raft {
  constructor({ n = 5, seed = 1, config = {} } = {}) {
    this.cfg = { ...CONFIG, ...config };
    this.rng = mulberry32(seed);
    this.now = 0;
    this.msgs = [];          // in flight: { id, from, to, type, ..., sent, arrive }
    this.events = [];        // human-readable log: { t, node, text, kind }
    this.leadersByTerm = new Map();
    this.nextMsgId = 0;
    this.nodes = Array.from({ length: n }, (_, id) => ({
      id, up: true, group: 0, state: "follower", term: 0, votedFor: null, log: [], commitIndex: 0,
      votes: new Set(), nextIndex: [], matchIndex: [], nextHeartbeat: 0, electionDeadline: 0, electionStart: 0, leaderId: null,
    }));
    for (const nd of this.nodes) this.resetElection(nd);
  }
  get majority() { return Math.floor(this.nodes.length / 2) + 1; }
  rand(a, b) { return a + this.rng() * (b - a); }
  note(node, text, kind = "info") { this.events.push({ t: Math.round(this.now), node, text, kind }); if (this.events.length > 400) this.events.shift(); }
  resetElection(nd) { nd.electionStart = this.now; nd.electionDeadline = this.now + this.rand(this.cfg.electionMin, this.cfg.electionMax); }
  lastIndex(nd) { return nd.log.length; }
  lastTerm(nd) { return nd.log.length ? nd.log.at(-1).term : 0; }
  reachable(a, b) { return this.nodes[a].up && this.nodes[b].up && this.nodes[a].group === this.nodes[b].group; }

  send(from, to, type, body) {
    const lat = this.rand(this.cfg.latencyMin, this.cfg.latencyMax);
    this.msgs.push({ id: this.nextMsgId++, from, to, type, ...body, sent: this.now, arrive: this.now + lat });
  }

  becomeFollower(nd, term) {
    if (nd.state !== "follower") this.note(nd.id, `steps down to follower (term ${term})`, "warn");
    nd.state = "follower"; nd.term = term; nd.votedFor = null; nd.votes = new Set();
  }

  startElection(nd) {
    nd.state = "candidate"; nd.term++; nd.votedFor = nd.id; nd.votes = new Set([nd.id]); nd.leaderId = null;
    this.resetElection(nd);
    this.note(nd.id, `timed out, starts an election for term ${nd.term}`, "warn");
    for (const p of this.nodes) if (p.id !== nd.id) this.send(nd.id, p.id, "RequestVote", { term: nd.term, lastLogIndex: this.lastIndex(nd), lastLogTerm: this.lastTerm(nd) });
    if (nd.votes.size >= this.majority) this.becomeLeader(nd); // n = 1
  }

  becomeLeader(nd) {
    nd.state = "leader"; nd.leaderId = nd.id;
    nd.nextIndex = this.nodes.map(() => nd.log.length + 1);
    nd.matchIndex = this.nodes.map(() => 0);
    const prev = this.leadersByTerm.get(nd.term);
    if (prev != null && prev !== nd.id) throw new Error(`safety violated: two leaders in term ${nd.term}`);
    this.leadersByTerm.set(nd.term, nd.id);
    this.note(nd.id, `wins with ${nd.votes.size} votes and becomes leader for term ${nd.term}`, "good");
    this.broadcastAppend(nd);
  }

  appendTo(nd, peer) {
    const ni = nd.nextIndex[peer];
    const prevLogIndex = ni - 1, prevLogTerm = prevLogIndex ? nd.log[prevLogIndex - 1].term : 0;
    const entries = nd.log.slice(prevLogIndex, prevLogIndex + this.cfg.maxBatch);
    this.send(nd.id, peer, "AppendEntries", { term: nd.term, prevLogIndex, prevLogTerm, entries, leaderCommit: nd.commitIndex });
  }
  broadcastAppend(nd) {
    for (const p of this.nodes) if (p.id !== nd.id) this.appendTo(nd, p.id);
    nd.nextHeartbeat = this.now + this.cfg.heartbeat;
  }

  // Sends to `to` if given (it must believe it's leader), else to the leader with the highest term.
  clientRequest(cmd, to = null) {
    const leader = to != null ? this.nodes[to] : this.leader();
    if (!leader || !leader.up || leader.state !== "leader") return null;
    leader.log.push({ term: leader.term, cmd });
    leader.matchIndex[leader.id] = leader.log.length;
    this.note(leader.id, `client asks to append "${cmd}" at index ${leader.log.length}`, "info");
    if (this.majority === 1) this.advanceCommit(leader);
    this.broadcastAppend(leader);
    return leader.id;
  }

  advanceCommit(nd) {
    for (let N = nd.log.length; N > nd.commitIndex; N--) {
      if (nd.log[N - 1].term !== nd.term) break; // only commit entries from the current term by counting
      const count = this.nodes.filter(p => p.id === nd.id || nd.matchIndex[p.id] >= N).length;
      if (count >= this.majority) {
        this.note(nd.id, `index ${N} is on a majority (${count}/${this.nodes.length}), so it's committed`, "good");
        nd.commitIndex = N; break;
      }
    }
  }

  deliver(m) {
    const nd = this.nodes[m.to];
    if (m.term > nd.term) { this.becomeFollower(nd, m.term); }
    switch (m.type) {
      case "RequestVote": {
        const upToDate = m.lastLogTerm > this.lastTerm(nd) || (m.lastLogTerm === this.lastTerm(nd) && m.lastLogIndex >= this.lastIndex(nd));
        const grant = m.term === nd.term && (nd.votedFor == null || nd.votedFor === m.from) && upToDate;
        if (grant) { nd.votedFor = m.from; this.resetElection(nd); }
        else if (m.term === nd.term && !upToDate) this.note(nd.id, `refuses vote to ${m.from}: its log is behind`, "warn");
        this.send(nd.id, m.from, "VoteReply", { term: nd.term, granted: grant });
        break;
      }
      case "VoteReply": {
        if (nd.state !== "candidate" || m.term !== nd.term || !m.granted) break;
        nd.votes.add(m.from);
        if (nd.votes.size >= this.majority) this.becomeLeader(nd);
        break;
      }
      case "AppendEntries": {
        if (m.term < nd.term) { this.send(nd.id, m.from, "AppendReply", { term: nd.term, success: false, matchIndex: 0 }); break; }
        if (nd.state !== "follower") this.becomeFollower(nd, m.term);
        nd.leaderId = m.from; this.resetElection(nd);
        if (m.prevLogIndex > nd.log.length || (m.prevLogIndex > 0 && nd.log[m.prevLogIndex - 1].term !== m.prevLogTerm)) {
          this.send(nd.id, m.from, "AppendReply", { term: nd.term, success: false, matchIndex: 0 });
          break;
        }
        let i = m.prevLogIndex;
        for (const e of m.entries) {
          if (nd.log.length > i && nd.log[i].term !== e.term) {
            this.note(nd.id, `drops conflicting entries from index ${i + 1}`, "warn");
            nd.log.length = i;
          }
          if (nd.log.length <= i) nd.log.push({ ...e });
          i++;
        }
        const last = m.prevLogIndex + m.entries.length;
        if (m.leaderCommit > nd.commitIndex) nd.commitIndex = Math.min(m.leaderCommit, last);
        this.send(nd.id, m.from, "AppendReply", { term: nd.term, success: true, matchIndex: last });
        break;
      }
      case "AppendReply": {
        if (nd.state !== "leader" || m.term !== nd.term) break;
        if (m.success) {
          nd.matchIndex[m.from] = Math.max(nd.matchIndex[m.from], m.matchIndex);
          nd.nextIndex[m.from] = nd.matchIndex[m.from] + 1;
          this.advanceCommit(nd);
          if (nd.nextIndex[m.from] <= nd.log.length) this.appendTo(nd, m.from);
        } else {
          nd.nextIndex[m.from] = Math.max(1, nd.nextIndex[m.from] - 1);
          this.appendTo(nd, m.from);
        }
        break;
      }
    }
  }

  step(dt) {
    const end = this.now + dt;
    while (true) {
      // next thing to happen: a message arrival or a timer
      let t = end;
      for (const m of this.msgs) if (m.arrive < t) t = m.arrive;
      for (const nd of this.nodes) if (nd.up) t = Math.min(t, nd.state === "leader" ? nd.nextHeartbeat : nd.electionDeadline);
      this.now = Math.max(this.now, t);
      const due = this.msgs.filter(m => m.arrive <= this.now).sort((a, b) => a.arrive - b.arrive || a.id - b.id);
      this.msgs = this.msgs.filter(m => m.arrive > this.now);
      for (const m of due) if (this.reachable(m.from, m.to)) this.deliver(m); else m.dropped = true;
      for (const nd of this.nodes) {
        if (!nd.up) continue;
        if (nd.state === "leader") { if (this.now >= nd.nextHeartbeat) this.broadcastAppend(nd); }
        else if (this.now >= nd.electionDeadline) this.startElection(nd);
      }
      if (this.now >= end) break;
    }
  }

  crash(id) {
    const nd = this.nodes[id]; if (!nd.up) return;
    nd.up = false; this.note(id, "crashed", "bad");
  }
  restart(id) {
    const nd = this.nodes[id]; if (nd.up) return;
    // term, votedFor and log are persisted; everything else is volatile
    Object.assign(nd, { up: true, state: "follower", commitIndex: 0, votes: new Set(), leaderId: null });
    this.resetElection(nd); this.note(id, "restarted as follower (log and term survived on disk)", "good");
  }
  setGroup(id, g) { this.nodes[id].group = g; }

  leader() {
    const ls = this.nodes.filter(n => n.up && n.state === "leader");
    return ls.length ? ls.reduce((a, b) => (b.term > a.term ? b : a)) : null;
  }
}
