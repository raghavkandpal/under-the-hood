# Roadmap

Plan for the next explainers, plus the working notes a new session needs. 99 explainers exist today, in 9 areas, 27 topics and 11 learning paths.

## Where the gaps are

Areas and topics as of the topics-and-paths change (99 explainers). Each explainer has an area and a topic in `catalog.js`; `PATHS` lists learning paths.

| Area | Count | Intro / Core / Deep | Topics | Gap |
|---|---|---|---|---|
| Systems: hardware & OS | 11 | 5 / 5 / 1 | Numbers & text, Memory, Operating systems | processes & syscalls, I/O |
| Networking & the web | 4 | 1 / 3 / 0 | How the network works | **thinnest area**: HTTP/2-3, CDNs, WebSockets, NAT, Wi-Fi |
| Databases & storage | 7 | 0 / 4 / 3 | Storage engines, Queries, Transactions & durability | **no intro** (what an index is, normalisation) |
| Distributed systems | 13 | 1 / 9 / 3 | Traffic & reliability, Spreading data, Agreement, Time & order | sharding, leader election |
| Security & cryptography | 10 | 4 / 5 / 1 | Building blocks, Protocols, Attacks & defences | XSS/CSRF, zero-knowledge (Batch 2) |
| Algorithms & data structures | 19 | 7 / 10 / 2 | Foundations, Data structures, Search & graphs, Compression & signals | balanced trees, string matching |
| Machine learning & AI | 20 | 8 / 9 / 3 | Classic ML, Neural networks, Language models | fine-tuning/LoRA, evaluation |
| Statistics & probability | 6 | 4 / 2 / 0 | Probability, Experiments & inference | **no deep dive**: regression, multiple testing |
| Developer tools | 9 | 1 / 7 / 1 | Version control, Building & shipping, Compilers & runtimes, Everyday tools | dependency resolution (Batch 2), debuggers |

New explainers: pick the topic when scaffolding (`npm run new -- <id> "<Title>" <area> <level> <topic>`), and add them to a learning path in `PATHS` if one fits. `tests/catalog.test.js` checks that path steps come after their prerequisites.

## Batch 1: fill the gaps ✅ done

All seven shipped on branch `explainers/batch-1`: sql-injection, cipher-modes, totp, query-planner, sat-sudoku, pipes, containers. The specs are kept below for reference.

Each spec gives the hook, what the reader does, the logic to build and test in the explainer's folder, and the facts the tests must pin down. Prereqs are existing ids.

### 1. `sql-injection`: SQL injection (security, intro; prereqs: sql-joins)
- **Hook:** a login form that builds SQL by gluing strings together.
- **Interactive:** type a username and password, then see the query string the app builds, with the user's text highlighted. A "query parser" view shows where data turns into code. Toggle *string concatenation* vs *parameterised query*.
- **sqlinject.js:** a tiny tokenizer for a SQL subset (`SELECT … WHERE a = '…' AND b = '…'`, `OR`, `--` comments), `buildConcat(user, pass)`, `buildParam(user, pass)` returning `{ sql, params }`, and `evaluate(query, usersTable)`, which returns the rows that would match.
- **Tests:** a normal login matches one row. Input `' OR '1'='1' --` matches every row with concatenation and none with parameters. Quotes in a legitimate name like `O'Brien` break concatenation but work with parameters.
- **Note:** simulated table only, and stress the fix. Keep the framing defensive, like the oauth page.

### 2. `cipher-modes`: Block cipher modes (security, core; prereqs: hash-functions)
- **Hook:** the "ECB penguin": encrypting an image block by block still shows the picture.
- **Interactive:** a small built-in pixel-art image (draw it in code, nothing copied) encrypted with ECB, CBC and CTR, each shown as an image. Flip one ciphertext bit and see what corrupts in each mode. Reuse a CTR nonce and XOR two ciphertexts to leak the plaintexts' XOR.
- **ciphermodes.js:** a toy 16-bit-block cipher (a few rounds of a Feistel network with a key schedule; say clearly it's a toy), plus `ecb`, `cbc`, `ctr` encrypt and decrypt over byte arrays.
- **Tests:** each mode round-trips. ECB maps equal blocks to equal ciphertext and CBC doesn't. A one-bit flip changes one block plus one bit in CBC, and only that bit in CTR. Two messages under a reused nonce satisfy c1 ⊕ c2 = p1 ⊕ p2.

### 3. `totp`: Two-factor codes (security, intro; prereqs: hash-functions)
- **Hook:** the 6-digit code in your authenticator app, which works offline. How does the server know it?
- **Interactive:** a shared secret, a live 30-second clock with a countdown ring, phone and server computing the same code side by side, a clock-drift slider showing the ±1 window, and a "phishing relay" note on why codes can be stolen live (passkeys fix that).
- **totp.js:** HMAC-SHA1 (reuse `sha1` from `shared/git.js`), `hotp(secret, counter)` with dynamic truncation, and `totp(secret, time, step = 30)`.
- **Tests:** the RFC 4226 test vectors (secret "12345678901234567890", counters 0–9 → 755224, 287082, …) and the RFC 6238 SHA-1 vectors at the given timestamps.

### 4. `query-planner`: Query planners & indexes (data, deep; prereqs: btree, sql-joins, columnar)
- **Hook:** the same query takes 2 ms or 20 s depending on whether the database uses an index.
- **Interactive:** a table of 1M rows with a selectivity slider for `WHERE price < X`. A cost chart shows sequential scan vs index scan (random page reads) crossing over. Toggle "stale statistics" and watch the planner choose badly. Also a composite-index column-order demo.
- **planner.js:** a cost model (`seqCost(pages)`, `indexCost(rows, height, randomPageCost)`), `choosePlan(stats, predicate)`, and a histogram-based selectivity estimate.
- **Tests:** the crossover exists and moves with `randomPageCost`. Low selectivity picks the index and high picks seq scan. Stale stats give a wrong choice whose true cost is worse.

### 5. `sat-sudoku`: Constraint solving (algorithms, deep; prereqs: dynamic-programming)
- **Hook:** Sudoku by brute force is around 10⁶⁰ guesses. A solver needs a handful.
- **Interactive:** a Sudoku grid stepping through backtracking with and without constraint propagation (naked singles, then "most constrained cell first"), counting guesses and backtracks, with the search tree depth as a small chart. Include a few built-in puzzles, generated by the code or carved from a solved grid, not copied from books.
- **sudoku.js:** `candidates(grid)`, `propagate(grid)`, `solve(grid, { propagate, mrv })` returning the solution plus counts, and `generate(seed, clues)`.
- **Tests:** solutions are valid and keep the givens. Propagation and MRV take 10–1000× fewer guesses than plain backtracking. A generated puzzle has a unique solution.

### 6. `pipes`: Shell pipes (tools, intro; prereqs: none)
- **Hook:** `cat log | grep ERROR | sort | uniq -c | head` chews through 10 GB with almost no memory.
- **Interactive:** a pipeline of 4 stages as boxes, with lines flowing through bounded buffers between them. Speed sliders per stage show the backpressure: a slow stage fills the buffer upstream. `head` closing early stops everything (SIGPIPE).
- **pipes.js:** a discrete-time simulation of stages with rates and a buffer size, returning per-tick buffer fill and throughput, and an `early exit` that stops upstream stages.
- **Tests:** throughput equals the slowest stage. Buffers never exceed capacity. With `head -n 10`, upstream work stops shortly after 10 lines. Memory stays bounded at buffer × stages regardless of input size.

### 7. `containers`: Containers (tools, core; prereqs: build-systems, virtual-memory)
- **Hook:** "works on my machine": a container ships the machine.
- **Interactive:** a Dockerfile-like list of steps builds layers. Edit a step and see which layers rebuild (cache invalidation from that line down). Reordering `COPY . .` before `RUN install` is the classic mistake. A second panel shows the process view: namespaces (its own PID 1, its own filesystem) and cgroup limits as gauges.
- **layers.js:** layer hashes chained from parent plus instruction plus input files, `rebuild(steps, changedFiles)`, and image size with layer sharing between two images.
- **Tests:** changing a file only rebuilds layers from its first `COPY` down. Identical prefixes share layers. Moving dependency install before `COPY . .` makes source edits cheap.

## Batch 2 (in progress)

Done on `explainers/batch-1`: rag, speculative-decoding, clock-sync, file-systems, quadtree, bootstrap. **Remaining: `zero-knowledge`, `dependency-resolution`.**

| id | Title | Area / level | Core idea to make interactive |
|---|---|---|---|
| `rag` | Retrieval-augmented generation | ml / core (embeddings, knn) | chunk a few built-in short documents (written for the page), embed with a toy bag-of-words, retrieve top-k for a question, show what the model would be given; chunk-size and k sliders; failure when the answer spans chunks |
| `speculative-decoding` | Speculative decoding | ml / deep (kv-cache, sampling) | a small draft model guesses k tokens and the big model verifies in one pass; acceptance-rate slider gives a speed-up curve; proof the output distribution is unchanged |
| `clock-sync` | Clock synchronisation | distributed / core (vector-clocks) | NTP's four timestamps, offset and delay maths, asymmetric-path error, drift between syncs, leap smearing |
| `file-systems` | File systems | systems / core (write-ahead-log, btree) | inodes, directory entries, block maps; hard vs soft links; crash mid-write with and without journaling |
| `quadtree` | Spatial indexes | algorithms / core (big-o) | click to add points, the quadtree splits; range query visits few nodes; compare with a geohash grid |
| `bootstrap` | Bootstrap confidence intervals | data / core (clt) | resample your one sample thousands of times; interval width vs n; where it fails (tiny n, heavy tails) |
| `zero-knowledge` | Zero-knowledge proofs | security / deep (signatures) | three-colouring proof: commit (hash) to a shuffled colouring, the verifier opens one edge; cheating chance falls as rounds increase |
| `dependency-resolution` | Dependency resolution | tools / core (build-systems) | semver ranges, a solver with backtracking, diamond conflicts, lockfiles |

## How to work (read before starting)

**Start:** run `npm test` and expect all tests passing (373 at the time of writing). The local preview config is `.claude/launch.json`, name `under-the-hood`, port 8766; it's git-ignored, so recreate it if missing. Or run `npm start` (port 8765).

**For each explainer:**
1. `npm run new -- <id> "<Title>" <area> <level>`. This creates `explainers/<id>/` (page, logic, test) and the catalog entry, and refuses to overwrite. Never hand-create files in `shared/` without checking they don't exist: an earlier session overwrote the RSA module (used by the signatures and TLS pages) this way.
2. Write the logic module and its tests first. Make the tests pin down *facts the page will claim*. Every number in the page's prose must come from the code or a test.
3. Build the page with shared pieces: `.row`, `.tabs` + `tabs()`, `.stats` + `statTile`, `.panel`, `.status`, `.scroll-x` (see README).
4. Verify in the browser: drive the controls with `javascript_tool`, read values, take a screenshot, check the console for errors. Bust caches after editing shared files: `await Promise.all(["shared/common.js","shared/style.css","catalog.js"].map(u => fetch(u, {cache:"reload"})))`.
5. Fill the catalog entry: tags, a one-line blurb, prereqs.
6. Commit per explainer.

**Lessons from earlier sessions:**
- **Prose must match the simulation.** Several drafts claimed things the numbers didn't show, e.g. "log₂ n rounds" for gossip (really ≈ log₂ n + ln n), 4-bit 70B "fits a gaming PC" (39 GB), backoff alone "fixes" retry storms (it doesn't after long outages). Run the scenario, then write the sentence.
- **Content filter:** a page embedding a long list of common English words with frequency ranks was blocked mid-write. Keep built-in data short and self-made (programming terms, invented scores, generated shapes or puzzles). Don't reproduce published word lists, texts or puzzle sets.
- **Async demos** need a generation counter so a Reset or a second click cancels a run in progress (see `explainers/text-buffers/`, `explainers/dynamic-programming/`).
- **Expensive recomputation on hover:** separate "render the view" from "recompute the stats".
- **Canvas with distance semantics** (knn) must be square, or circles look like ellipses.
- **Bash:** pipe `< /dev/null` into node commands. A stray `cat > file` with no heredoc hangs waiting on stdin.
- **Hidden browser pane** pauses `requestAnimationFrame`: override it with `setTimeout` inside the iframe for checks.

**Final sweep (run before ending a session):** from `index.html` in the browser, start the sweep detached and poll, since a single call times out:

```js
window.__sweep = { done: 0, bad: [], finished: false };
(async () => {
  const { CATALOG } = await import("./catalog.js?" + Date.now()), S = window.__sweep;
  for (const page of ["index.html", ...CATALOG.map(e => `explainers/${e.id}/`)]) {
    const f = document.createElement("iframe"); f.style.cssText = "position:fixed;left:0;top:0;width:360px;height:700px;opacity:0";
    document.body.append(f); const errs = [];
    await new Promise(r => { f.onload = r; f.src = page; });
    f.contentWindow.addEventListener("error", e => errs.push(e.message));
    f.contentWindow.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
    await new Promise(r => setTimeout(r, 600));
    const d = f.contentDocument, w = d.documentElement.scrollWidth;
    if (w > 362 || errs.length || !d.querySelector("main h1") || !d.querySelector("header")) S.bad.push(`${page}: width=${w} ${errs}`);
    f.remove(); S.done++;
  }
  S.finished = true;
})();
// then poll: window.__sweep  → expect bad: []
```

Expect `bad: []`: no script errors, nothing wider than a 360px phone, and every page rendering its header.
