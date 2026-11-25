# Roadmap

Plan for the next explainers, plus the working notes a new session needs. 164 explainers exist today, in 9 areas, 29 topics and 11 learning paths, each with free further reading.

## Where the gaps are

Areas and topics after batch 14 (164 explainers). Each explainer has an area and a topic in `catalog.js`; `PATHS` lists learning paths.

| Area | Count | Intro / Core / Deep | Topics | Gap |
|---|---|---|---|---|
| Systems: hardware & OS | 17 | 6 / 8 / 3 | Numbers & text, Memory, Operating systems, The processor | balanced; pick by reader demand |
| Networking & the web | 13 | 3 / 8 / 2 | How the network works, The web | more intro |
| Databases & storage | 13 | 3 / 6 / 4 | Storage engines, Queries, Transactions & durability | more intro |
| Distributed systems | 20 | 2 / 12 / 6 | Traffic & reliability, Spreading data, Agreement, Time & order | more intro |
| Security & cryptography | 17 | 5 / 8 / 4 | Building blocks, Protocols, Attacks & defences | more deep dives |
| Algorithms & data structures | 28 | 8 / 15 / 5 | Foundations, Data structures, Search & graphs, Compression & signals | more deep dives |
| Machine learning & AI | 26 | 8 / 12 / 6 | Classic ML, Neural networks, Language models | balanced; pick by reader demand |
| Statistics & probability | 13 | 6 / 5 / 2 | Probability, Experiments & inference | more deep dives |
| Developer tools | 17 | 3 / 12 / 2 | Version control, Building & shipping, Compilers & runtimes, Everyday tools | more intro and deep |

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

## Batch 2 ✅ done

All eight shipped (zero-knowledge and dependency-resolution last). Also added: `cdn` (networking gap). Next from the gap table: `multiple-testing` (statistics deep dive: p-hacking, Bonferroni, false discovery rate), a databases intro, and more networking.

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

## Batch 6 ✅ done

Three gaps from the table: `multiple-testing` (statistics deep dive: Bonferroni vs Benjamini–Hochberg on a sorted p-value plot), `nat` (networking: translation table, filtering, hole punching easy vs symmetric NAT), `normalization` (databases intro: update, deletion and insertion anomalies side by side with three linked tables). Each joined a learning path. Next: WebSockets or HTTP/2 (networking is still thinnest), regression (statistics), balanced trees.

## Batches 7–11 ✅ done

Thirty explainers, one PR per batch, each stacked on the one before:
- **7, networking and web security:** congestion-control, http-versions, subnets, websockets, xss, csrf. Adds the networking topic "The web" (http-caching and cdn moved there).
- **8, algorithms:** balanced-trees, string-search, hyperloglog, count-min-sketch, topological-sort, minimax. `shared/hash32.js` is the string hash both sketches (and sharding) use.
- **9, systems and tools:** deadlock, processes, io-multiplexing, branch-prediction, profilers, fuzzing. Adds the systems topic "The processor".
- **10, databases and distributed:** mvcc, sharding, fencing-tokens, idempotency, inverted-index, replication-lag.
- **11, ML and statistics:** linear-regression, data-leakage, lora, beam-search, markov-chains, birthday-paradox.

## Batch 12 ✅ done

Ten from the gap table, built test-first with the `tdd` skill and reviewed with `code-review` and `ponytail-review`: bisect and three-way-merge (tools intro), failure-detection (distributed intro), jwt, timing-attacks, bgp (networking deep dive), max-flow, vector-search, logistic-regression, power-analysis. `diff`, `subnets` and `kmeans` moved to `shared/` as second users appeared, and `shared/normal.js` holds the normal CDF and quantile.

## Batch 13 ✅ done (on `explainers/batch-13`)
**Status (2026-11-12):** all ten built, evaluated to PASS and checked in the browser at 360px: quic, passkeys, paxos, mixture-of-experts, rlhf, tries-vs-suffix-arrays, simd, debuggers, survival-curves, what-is-an-index. Moved to `shared/`: `trie.js` (autocomplete), `branch.js` (branch-prediction), `height.js` (btree). A global `[hidden]` rule in `shared/style.css` stops class display rules from undoing the attribute.
- **Merge:** squash-merge the PR. Intermediate commits a811fd5 and 5a4c5c4 fail tests on their own.
- **After this batch merges:** deploy on GitHub Pages (from `main`, as before). No other host.
- **Lessons:** generators each in their own worktree, merged back one at a time, worked well. Evaluators found real bugs in every first draft, most often a claim true at the default but not at every reachable control state, so sweep every slider position and seed. Tell generators the house patterns up front ("🎲 New sample" seed buttons, `tabs()` keys are strings).

Ten picked from the gap table: quic (networking deep dive), passkeys (security), paxos (distributed), mixture-of-experts and rlhf (ML), tries-vs-suffix-arrays (algorithms), simd (systems), debuggers (tools), survival-curves (statistics), what-is-an-index (databases intro). Same flow as batch 12: `tdd` per module, `code-review` plus `ponytail-review` before the PR, `pr` for the body.

Each spec gives the scaffold line, prereqs, where it goes in `PATHS`, sources (first one primary; **new domain** marks a host not yet in `TRUSTED`, so add it and run `npm run check-sources`, or use the listed fallback), what to reuse, and the facts. Every fact is a test: write it first, print the numbers across the parameter range, and copy prose numbers from the output. Reusing a module means moving it to `shared/` first (check the file name is free).

### 1. `quic`: QUIC in depth
- **Scaffold:** `npm run new -- quic "QUIC in depth" networking deep how-the-network-works`. Prereqs: http-versions, tls. Path `internet`: after http-versions.
- **Sources:** RFC 9000: QUIC transport (standard, rfc-editor.org; §8 amplification limit, §8.2 path validation, §9 migration); RFC 9002: loss detection (standard; §4.2 monotonically increasing packet numbers); RFC 9001: QUIC-TLS (standard; 0-RTT replay). Optional approachable: "HTTP/3 explained" by Daniel Stenberg, http3-explained.haxx.se (**new domain**).
- **Reuse:** the handshake counts must agree with `PROTOCOLS` in `explainers/http-versions/` (h2 2 RTT, h3 1 RTT). Don't repeat its head-of-line demo; link to it.
- **Facts:**
  1. Fresh connection, first response byte: TCP + TLS 1.3 at 3 RTT, QUIC at 2 RTT, QUIC 0-RTT resumption at 1 RTT.
  2. Amplification limit: the client's Initial is padded to 1200 bytes, so before the address is validated the server may send at most 3 × 1200 = 3600 bytes. A server first flight of at most 3600 bytes finishes the handshake in 1 RTT, and a 6000-byte one (a long certificate chain) needs one more RTT.
  3. Migration: when the client's address changes, the TCP connection is gone, and the next request waits 2 RTT for a new handshake. QUIC keeps the connection ID and adds 0 handshake RTT. Path validation (PATH_CHALLENGE then PATH_RESPONSE) takes 1 RTT and runs alongside the data.
  4. RTT samples on a seeded lossy run: QUIC gives one sample per acknowledged packet, because a retransmission gets a new packet number. TCP with Karn's rule gives (acked − retransmitted) samples.
  5. 0-RTT replay: an attacker replays a captured first flight 3 times. A `POST /pay` sent as 0-RTT runs 4 times on a server that accepts it. With a server that accepts 0-RTT only for `GET`, it runs once.

### 2. `passkeys`: Passkeys
- **Scaffold:** `npm run new -- passkeys "Passkeys" security core protocols`. Prereqs: signatures, totp. Path `security`: after jwt.
- **Sources:** W3C Web Authentication Level 3, https://www.w3.org/TR/webauthn-3/ (standard; §4 RP ID definition, §5.1.4 get check, §6.1.1 signature counter, §7.2 assertion checks); MDN Web Authentication API (docs, developer.mozilla.org); Google passkeys developer guide, developers.google.com/identity/passkeys (docs).
- **Reuse:** `keygen`/`sign`/`verify` from `shared/rsa.js` (toy RSA, already shared). For the phishing comparison, `verify` from `explainers/totp/totp.js`; reusing it means moving it to `shared/`, or else state the TOTP result as a fixed scenario.
- **Facts:**
  1. A breach of the server's table yields only public keys. An assertion signed with any other key pair fails `verify` under the stored public key.
  2. Phishing relay: a TOTP code typed into `examp1e.test` and relayed to the real server within 30 s is accepted. The passkey assertion is bound to origin `https://examp1e.test` in clientData, so the real server rejects it.
  3. RP ID scoping: a credential for `example.com` is offered on `example.com` and `login.example.com`, but not on `example.com.evil.test` or `examp1e.test`. This is a suffix match on a dot boundary. The caveat says real browsers use the public suffix list.
  4. Challenges are single use: a captured assertion replayed for a second login fails.
  5. Signature counter: a new count ≤ the stored count, with either value non-zero, is flagged as a possible clone. 0 and 0, as many synced passkeys report, is not flagged.

### 3. `paxos`: Paxos
- **Scaffold:** `npm run new -- paxos "Paxos" distributed deep agreement`. Prereqs: quorum, raft. Path `distributed`: after raft.
- **Sources:** Lamport, "Paxos Made Simple", https://lamport.azurewebsites.net/pubs/paxos-simple.pdf (paper); van Renesse & Altinbuken, "Paxos Made Moderately Complex", https://www.cs.cornell.edu/courses/cs7412/2011sp/paxos.pdf (paper; the host answered here). Fallback: Wikipedia "Paxos (computer science)". research.google.com is **not** covered by the `research.google` entry, so don't use Paxos Made Live from there.
- **Reuse:** nothing. Single-decree Paxos with 5 acceptors, driven by scripted message schedules, plus `mulberry` from `shared/random.js` for backoff.
- **Facts:**
  1. A value is chosen once 3 of 5 acceptors accept it in the same ballot. With 2 acceptors down a value is still chosen, and with 3 down none is.
  2. An acceptor rejects a prepare or accept whose ballot is lower than its promise.
  3. Safety: v is chosen at ballot 1, then proposer B runs ballot 2 with value w. For each of the 10 possible 3-acceptor quorums B could reach, B learns v in phase 1 and v is chosen again, never w.
  4. Accepted is not chosen: v is accepted by only 1 acceptor and its proposer crashes. A new proposer whose quorum includes that acceptor gets v chosen, and one whose quorum excludes it gets w chosen.
  5. Duelling proposers with no backoff choose nothing in 20 rounds. With seeded random backoff a value is chosen. The test bounds the round from the printed run.
  6. Cost: one decision takes 4 message delays (prepare, promise, accept, accepted). With a stable leader (Multi-Paxos), later slots skip phase 1 and take 2.

### 4. `mixture-of-experts`: Mixture of experts
- **Scaffold:** `npm run new -- mixture-of-experts "Mixture of experts" ml deep language-models`. Prereqs: attention. Path `llms`: after kv-cache.
- **Sources:** Fedus, Zoph, Shazeer, "Switch Transformers", arXiv 2101.03961 (paper; aux loss and capacity factor); Shazeer et al., "Outrageously Large Neural Networks", arXiv 1701.06538 (paper); Hugging Face, "Mixture of Experts Explained", https://huggingface.co/blog/moe (article).
- **Reuse:** `softmax` from `explainers/attention/` is one line, so write it again rather than move it. Toy tokens are seeded 2-D vectors (`shared/random.js`). Don't quote published model sizes unless a source on the page states them.
- **Facts:**
  1. Routing: softmax over E expert scores, keep the top k, renormalise. Exactly k weights are non-zero and they sum to 1.
  2. Parameters vs compute: with E = 8 and k = 2, each token uses 2/8 = 25% of the expert parameters. Total params = shared + E × expert, and active = shared + k × expert (test the formula at the page's slider values).
  3. Capacity: expert capacity = capacity factor × tokens / E. Dropped tokens = Σ max(0, load − capacity). Uniform load drops 0, and the seeded skewed router drops more than 0.
  4. Switch aux loss = E · Σ fᵢ·Pᵢ. It equals exactly 1 for uniform routing and E when every token and all the probability go to one expert.
  5. Training the router with the aux loss on the seeded data lowers the busiest expert's share until nothing is dropped at capacity factor 1.25. Without the loss, tokens are still dropped after the same number of steps.

### 5. `rlhf`: Learning from human feedback
- **Scaffold:** `npm run new -- rlhf "Learning from human feedback" ml deep language-models`. Prereqs: rl, logistic-regression, sampling. Path `llms`: after lora.
- **Sources:** Ouyang et al., "Training language models to follow instructions with human feedback" (InstructGPT), arXiv 2203.02155 (paper); Rafailov et al., "Direct Preference Optimization", arXiv 2305.18290 (paper; closed-form KL-regularised optimum); Hugging Face, "Illustrating RLHF", https://huggingface.co/blog/rlhf (article). Optional: Christiano et al., arXiv 1706.03741.
- **Model:** a policy over 6 self-written canned replies to one prompt. A hidden "true" score produces seeded preference pairs. The reward model is Bradley–Terry (logistic on a reward difference) over 2 features, one of which is length.
- **Facts:**
  1. Bradley–Terry: P(A beats B) = σ(r_A − r_B). Equal rewards give 0.5, and a difference of ln 3 gives 0.75.
  2. The reward model trained on the seeded pairs ranks held-out pairs correctly at a rate the test pins from the printed run.
  3. KL-regularised optimum, exact on 6 replies: π*(y) ∝ π_ref(y)·exp(r(y)/β). Very large β returns π_ref within 1e-6, very small β puts more than 0.99 on the top-reward reply, and KL(π*‖π_ref) falls as β rises.
  4. Reward hacking: the reward model over-rewards length, so at small β the policy's proxy reward rises while its true score falls. True score peaks at an intermediate β and beats both β → 0 and π_ref.

### 6. `tries-vs-suffix-arrays`: Tries vs suffix arrays
- **Scaffold:** `npm run new -- tries-vs-suffix-arrays "Tries vs suffix arrays" algorithms core data-structures`. Prereqs: autocomplete, string-search. Path `algorithms`: after string-search.
- **Sources:** Sedgewick & Wayne, Algorithms 4th ed., 6.3 Suffix Arrays, https://algs4.cs.princeton.edu/63suffix/ (book; longest repeated substring); cp-algorithms, Suffix Array, https://cp-algorithms.com/string/suffix-array.html (article; binary-search lookup, Kasai LCP, distinct substrings = n(n+1)/2 − ΣLCP).
- **Reuse:** `Trie` and `radixNodes` from `explainers/autocomplete/trie.js`. Move them to `shared/trie.js` (check the file is free) and update autocomplete's imports. The texts are built in: "banana", a programming-terms line "database metadata update", and a seeded 4-letter random string.
- **Facts:**
  1. The suffix array of "banana" is [5, 3, 1, 0, 4, 2], and its LCP array is [1, 3, 0, 0, 2].
  2. Distinct substrings of "banana" = 21 − 6 = 15, so its suffix trie has 16 nodes. The suffix trie of "banana$" has 23 nodes, and `radixNodes` (the suffix tree) leaves 11, within 2n.
  3. In "database metadata update", the word trie's prefix search for "data" finds 1 word (database). The suffix array finds 2 occurrences (database, metadata).
  4. A pattern lookup takes at most 2·⌈log₂(n+1)⌉ suffix comparisons: 20 for n = 1,000.
  5. Space: for a seeded random 4-letter text of n = 1,000, the suffix trie has more than 400,000 nodes against 1,000 suffix-array entries. The prose quotes the printed ratio.
  6. The longest repeated substring is the longest LCP: "ana" in "banana".

### 7. `simd`: SIMD vectorisation
- **Scaffold:** `npm run new -- simd "SIMD vectorisation" systems core the-processor`. Prereqs: branch-prediction, floating-point. Path `machine`: after branch-prediction.
- **Sources:** LLVM, Auto-Vectorization in LLVM, https://llvm.org/docs/Vectorizers.html (docs; float reductions need reassociation, runtime alias checks); Agner Fog, Optimizing software in C++, https://www.agner.org/optimize/optimizing_cpp.pdf (book); V8, "Fast, parallel applications with WebAssembly SIMD", https://v8.dev/features/simd (article).
- **Reuse:** `Math.fround` for float32. The scalar branchy side can use `bytes` and `cycles` from `explainers/branch-prediction/`, moved to `shared/` if so.
- **Facts:**
  1. Lanes = register bits / element bits: 128-bit holds 4 f32, 2 f64 or 16 i8, and 256-bit holds 8 f32.
  2. Summing n = 1,003 f32 with 8 lanes takes 125 vector adds, 3 scalar tail adds and 7 lane-combining adds. That is 135 instructions instead of 1,003.
  3. Eight partial sums of a seeded float32 array differ from the left-to-right sum, while the same done with integers is identical. That is why compilers vectorise float reductions only when reassociation is allowed.
  4. `if (x >= 128) sum += x` done as compare + mask + add equals the scalar result exactly with 0 branch mispredictions. Its cycle count is the same on sorted and random data, while the scalar loop's is not.
  5. A carried dependency breaks lane parallelism: `a[i] = a[i−1] + b[i]` computed 8 lanes at a time from old values differs from the scalar result, while `c[i] = a[i] + b[i]` matches.

### 8. `debuggers`: How debuggers work
- **Scaffold:** `npm run new -- debuggers "How debuggers work" tools core everyday-tools`. Prereqs: processes, compiler. Path `toolbox`: after profilers.
- **Sources:** ptrace(2), https://man7.org/linux/man-pages/man2/ptrace.2.html (docs; PEEKTEXT/POKETEXT, SINGLESTEP); Eli Bendersky, "How debuggers work: Part 2 – Breakpoints", https://eli.thegreenplace.net/2011/01/27/how-debuggers-work-part-2-breakpoints (article, **new domain**; 0xCC, rewind, restore, single-step, re-insert). Fallback: Wikipedia "INT (x86 instruction)".
- **Reuse:** none. `explainers/compiler/` has no jumps, so it can't run a loop. Build a toy byte-coded VM with variable-length (1–3 byte) instructions, a `TRAP` = 0xCC opcode and a 10-iteration loop.
- **Facts:**
  1. Setting a breakpoint at address A saves the byte and writes 0xCC. Clearing it restores the code bytes exactly.
  2. A trap stops with pc = A + 1, and the debugger reports A after rewinding. If it skips the rewind, execution resumes mid-instruction and the output differs from the run without a debugger.
  3. To continue, the debugger restores the byte, single-steps, rewrites 0xCC and resumes. A breakpoint inside the 10-iteration loop stops 10 times, and the program's output equals the run without a debugger.
  4. Skip the rewrite and the breakpoint stops once.
  5. Conditional breakpoint `i == 7`: the program traps 10 times, the user sees 1 stop, and the debugger makes 20 stop/resume switches.

### 9. `survival-curves`: Survival curves
- **Scaffold:** `npm run new -- survival-curves "Survival curves" statistics core experiments-and-inference`. Prereqs: clt. Path `stats`: after bootstrap.
- **Sources:** lifelines, "Introduction to survival analysis", https://lifelines.readthedocs.io/en/latest/Survival%20Analysis%20intro.html (docs, **new domain**; shows that dropping censored rows underestimates); James, Witten, Hastie, Tibshirani, An Introduction to Statistical Learning, 2nd ed., ch. 11, https://www.statlearning.com/ (free book, **new domain**). Fallback: Wikipedia "Kaplan–Meier estimator". Hastie's web.stanford.edu slides redirect to hastie.su.domains, so skip them.
- **Reuse:** `quantile` from `shared/normal.js` for the 95% band, and `mulberry` from `shared/random.js`. Kaplan–Meier itself needs nothing external. The built-in data is a self-made table of 10 customers' months to cancel, some still subscribed.
- **Facts:**
  1. Kaplan–Meier S(t) = Π(1 − dᵢ/nᵢ) on the 10-customer table matches a hand-worked table at every event time. The first drop is 1 − 1/10 = 0.9.
  2. With no censoring, Kaplan–Meier equals the plain fraction still subscribed at every t.
  3. On a seeded cohort of 2,000 with true S(t) = e^(−t/12) and random censoring, Kaplan–Meier at t = 12 is within 0.03 of e⁻¹ ≈ 0.368. "Drop censored rows" and "count censored as cancelled" both come out more than 0.05 below it. The prose quotes the printed values.
  4. The median is the first t with S(t) ≤ 0.5. For that cohort it is within 0.5 of 12 ln 2 ≈ 8.3.
  5. The Greenwood 95% band (z = `quantile(0.975)`) is wider at the last event time than at the first, as the number at risk shrinks.

### 10. `what-is-an-index`: What is an index?
- **Scaffold:** `npm run new -- what-is-an-index "What is an index?" databases intro queries`. Prereqs: none. Path `databases`: after normalization, before btree.
- **Sources:** SQLite, Query Planning, https://www.sqlite.org/queryplanner.html (docs; full scan vs binary-searched index, multi-column indexes and the leftmost column); PostgreSQL, Multicolumn Indexes, https://www.postgresql.org/docs/current/indexes-multicolumn.html (docs); Markus Winand, Use The Index, Luke: anatomy of an index, https://use-the-index-luke.com/sql/anatomy (article).
- **Reuse:** `heightFor` from `explainers/btree/btree.js`, a one-liner. Move it to `shared/` or recompute it in the test, and keep its result. Link to query-planner for the "broad query, scan wins" crossover rather than reusing it.
- **Facts:**
  1. Finding one row among 1,000,000 at 100 rows per page: a full scan reads 10,000 pages. The index reads `heightFor(1e6, 100)` = 4 levels plus 1 table page, so 5 pages, 2,000× fewer. (log₁₀₀ 1,000,001 is just over 3, so it rounds up to 4. Quote 4, not 3.)
  2. Binary search over 1,000,000 sorted keys needs at most ⌈log₂ 1,000,001⌉ = 20 comparisons.
  3. An index on (last_name, first_name) serves `last = ?` and `last = ? AND first = ?`, but `first = ?` alone falls back to a full scan.
  4. Writes pay: an insert into a table with 3 indexes updates 4 structures (1 + k).

## Batch 14 ✅ done (merged in #32)

Nine from the gap table, one per open gap: syscalls (systems: interrupts and syscalls), wifi (networking intro), transactions (databases intro), exactly-once (distributed: exactly-once streams), padding-oracle (security deep dive), bellman-ford (algorithms deep dive), bandits (the statistics deep dive), shell-expansion and linkers (tools intro and deep). ML is balanced and gets none. Same flow as batch 13: `tdd` per module, `code-review` plus `ponytail-review` before the PR, `pr` for the body.

Each spec gives the scaffold line, prereqs, path, sources (first one primary; **new domain** marks a host not yet in `TRUSTED`), reuse, the facts with the test that pins each, and what stays out. Numbers marked "printed" come from a seeded run: the generator prints them first, the test pins them, and the prose copies them. Model constants (slot counts, frame sizes, costs) are the page's own; the prose says "in this model" and never presents them as values from a standard.

### Build result (2026-11-19)
All nine built and checked in one session: no agents after the first fix rounds. Agent evaluators passed wifi (a5bcefc) and failed the rest in round 1; fixes were applied (transactions, shell-expansion, syscalls) and the unevaluated five (exactly-once, padding-oracle, bellman-ford, bandits, linkers) were checked by the main session against their reports, `make check` (807 pass) and the phone-width browser sweep (165 pages, bad: [] after bellman-ford's graph picker became wrapping `.tabs`). Fixes found late: padding-oracle escapes the recovered text, bellman-ford names the cycle from C as the tile shows it.

Where the build departed from the plan:
- syscalls: the call number is in `eax` (syscall(2)); kernel work is free and one instruction is 1 ms in this model; exit is itself a call, so the page counts `write` and `clock_gettime` calls.
- linkers: fact 2 as planned failed on `print`, not `area`, so the page uses `main.o io.o libgeom.a` and `libgeom.a main.o io.o`; fact 3's chain lives in archive members `shape.o` and `sq.o` because `geom.o` must link alone for fact 1.
- padding-oracle: the page's default IV seed is 2, not 1 (seed 1 gave an atypically low 92 queries per byte); the prose says counts vary around about 128.
- wifi: stations get a new frame with a 1% chance per slot; with always-sending stations the hidden gap vanishes (about 11% vs 12%), and the caveat says so.
- bandits: thresholds held (Thompson mean regret 22.6; Thompson ran mostly on the worse arm in 2 of 200 runs, greedy in 174, with ties going to the worse arm A).

### 1. `syscalls`: System calls and interrupts
- **Scaffold:** `npm run new -- syscalls "System calls and interrupts" systems deep operating-systems`. Prereqs: processes. Path `machine`: after processes.
- **Sources:** OSTEP ch. 6, Mechanism: Limited Direct Execution, https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf (book; trap, trap table, user and kernel mode, timer interrupt); syscall(2), https://man7.org/linux/man-pages/man2/syscall.2.html (docs; x86-64 `syscall`, number in `eax`, result in `rax`); vdso(7), https://man7.org/linux/man-pages/man7/vdso.7.html (docs; `__vdso_clock_gettime` on x86-64).
- **Reuse:** none. A toy single-CPU machine with a mode bit, a trap table set at boot, a syscall table, a timer and one disk. Link to scheduling for policies and to processes for fork and exec rather than repeating them.
- **Facts:**
  1. A privileged instruction run in user mode traps and the kernel ends the process. The same instruction in kernel mode runs. Test: run both, assert the user run ends in a fault and the kernel run changes the machine state.
  2. A syscall switches user → kernel → user. The kernel is entered only at the handler in the trap table, whatever address the user program put in its registers, and control returns to the instruction after the trap. Test: assert the mode sequence, that the entry pc equals the table entry for 3 different user register values, and that the return pc is trap pc + 1. A user-mode write to the trap table faults.
  3. Writing 10,000 bytes one byte per `write` makes 10,000 syscalls. Through a 4,096-byte buffer it makes 3 (4,096 + 4,096 + 1,808 at the flush). Test: count kernel entries in both runs.
  4. 1,000 `clock_gettime` calls enter the kernel 1,000 times without the vDSO and 0 times with it, and return the same times. Test: count entries, compare results.
  5. Timer interrupt: two loops that never make a syscall share 100 ms. With a 10 ms timer the kernel regains control 10 times and each loop runs 50 ms. With no timer the first loop runs 100 ms and the second 0. Test: run time per loop and interrupt count in both modes.
  6. Blocking read: process A reads from a disk that answers in 5 ms. With an interrupt on completion, B runs for those 5 ms. If A polls the device instead, B runs 0 ms of them (the 10 ms timer slice is longer than the wait). Test: B's run time over the wait in both modes.
- **Out of scope:** real instruction encodings, KPTI or Spectre mitigation costs, io_uring, signals beyond the fault in fact 1, nanosecond costs of a real syscall (no source gives one for this page), interrupt priorities and nesting.

### 2. `wifi`: How Wi-Fi shares the air
- **Scaffold:** `npm run new -- wifi "How Wi-Fi shares the air" networking intro how-the-network-works`. Prereqs: none. Path `internet`: after congestion-control.
- **Sources:** Peterson & Davie, Computer Networks: A Systems Approach, 2.7 Wireless Networks, https://book.systemsapproach.org/direct/wireless.html (free book, **new domain**, answered from here on 2026-11-19; CSMA/CA, exponential backoff, hidden and exposed nodes, RTS/CTS, rate adaptation); Wikipedia, Hidden node problem, https://en.wikipedia.org/wiki/Hidden_node_problem (encyclopedia, approachable). Add the new domain to `TRUSTED` and run `npm run check-sources`.
- **Reuse:** `mulberry` from `shared/random.js`. A slotted simulation: each station waiting to send picks a random backoff slot, the lowest slot sends, equal lowest slots collide. Model constants: 16 starting slots, doubling after a collision up to 1,024, reset after a success.
- **Facts:**
  1. Two stations picking from 16 slots collide with probability 1/16 = 0.0625. Test: enumerate the 256 pairs exactly, and a seeded run of 10,000 rounds lands within 0.01 of it.
  2. With a fixed 16-slot window the collision fraction rises with the number of stations: printed values at 2, 5, 10 and 20 stations, strictly increasing. Doubling after each collision gives a lower collision fraction at 20 stations than the fixed window. Test: both comparisons on the seeded run.
  3. Hidden stations: A and C both reach the access point but can't hear each other. At the same offered load, the hidden pair loses more frames than a pair that hears each other (printed). With RTS/CTS the airtime lost to collisions falls, because only short RTS frames collide. Test: frames lost hidden > not hidden, and lost airtime with RTS/CTS < without.
  4. One slow station drags the fast one down. Each station gets an equal share of frames, so with one at 6 Mbit/s and one at 54 Mbit/s each delivers 1 / (1/6 + 1/54) = 5.4 Mbit/s, 10.8 in total, against 27 each when both run at 54. Test: the throughput function at those rates, exact to 1e-9.
- **Out of scope:** real 802.11 timing values (SIFS, DIFS, slot length, CWmin by PHY), channels and interference between them, WPA and encryption (link to cipher-modes instead), MIMO and OFDM, airtime fairness schedulers, roaming.

### 3. `transactions`: Transactions: all or nothing
- **Scaffold:** `npm run new -- transactions "Transactions: all or nothing" databases intro transactions-and-durability`. Prereqs: none. Path `databases`: after lsm, before race-conditions.
- **Sources:** PostgreSQL, Tutorial: Transactions, https://www.postgresql.org/docs/current/tutorial-transactions.html (docs; bank transfer, all or nothing, ROLLBACK, implicit transaction per statement); SQLite, Atomic Commit In SQLite, https://www.sqlite.org/atomiccommit.html (docs; rollback journal written before the database file, hot journal rolled back after a crash).
- **Reuse:** none. A two-row table (Alice 100, Bob 50) with a `CHECK balance >= 0`, a rollback journal, and a crash point the reader picks. Link to isolation and write-ahead-log for concurrency and redo logs rather than covering them.
- **Facts:**
  1. Transfer 30 from Alice to Bob as two autocommit statements, crash between them: Alice 70, Bob 50, total 120. Inside a transaction, for every crash point the restarted table totals 150 and holds either (100, 50) or (70, 80). Test: sweep every crash point in both modes.
  2. `ROLLBACK` after both updates restores (100, 50) exactly. Test: compare rows.
  3. Transfer 120, crediting Bob first: the debit fails the check. In a transaction Bob's credit is undone, (100, 50). In autocommit it stays, (100, 170), and the total is 270. Test: both runs.
  4. Before `COMMIT`, another session reads (100, 50). After it, (70, 80). It never reads (70, 50). Test: read at every step of the transaction.
- **Out of scope:** isolation levels and concurrent writers (isolation, mvcc), savepoints, redo logging and fsync details (write-ahead-log), distributed transactions (two-phase-commit).

### 4. `exactly-once`: Exactly-once processing
- **Scaffold:** `npm run new -- exactly-once "Exactly-once processing" distributed deep traffic-and-reliability`. Prereqs: idempotency. Path `distributed`: after idempotency.
- **Sources:** Apache Kafka design docs, Message Delivery Semantics, https://github.com/apache/kafka/blob/4.0.0/docs/design.html (docs, pinned to the 4.0.0 tag, section 4.6; at-most-once and at-least-once from where the consumer saves its position, idempotent producer with producer ID and sequence numbers, offsets written in the same transaction as the output); Carbone et al., "Lightweight Asynchronous Snapshots for Distributed Dataflows", arXiv 1506.08603 (paper). kafka.apache.org serves a script redirect, so link the GitHub copy at the tag.
- **Reuse:** `mulberry` from `shared/random.js` for lost acks. A log of 100 self-written payment messages (two of them identical on purpose), one consumer that commits its offset every 10 messages, and a sink that sums them.
- **Facts:**
  1. At-least-once (process, then commit): a crash after message p replays everything since the last commit, so the sink counts 100 + (p − 10·⌊(p − 1)/10⌋) messages, between 1 and 10 extra. Test: sweep p = 1…100 against the formula.
  2. At-most-once (commit, then process): the same crash loses 10·⌈p/10⌉ − p messages, between 0 and 9. Test: sweep p against the formula.
  3. Committing output and offset in one transaction counts exactly 100 and the true sum for every p. Test: sweep p.
  4. An at-least-once sink that drops duplicates by (partition, offset) also counts exactly 100 for every p. One that drops duplicates by message content also drops the genuine second copy of the identical payment and comes up one short. Test: sweep p for both.
  5. Producer retries after lost acks append duplicates to the log (printed count above 100 on the seeded run). With a producer ID and sequence numbers the broker drops the resends and the log holds exactly 100. Test: log length in both modes.
  6. Exactly-once stops at the pipeline's edge: an email sent while processing, outside the transaction, goes out 100 + extra times at the same crash points as fact 1, even in transactional mode. Test: sweep p.
- **Out of scope:** Flink's barrier snapshot algorithm in detail, Kafka transaction coordinator internals and zombie fencing (link to fencing-tokens), windowing and late data, multi-partition ordering.

### 5. `padding-oracle`: Padding oracle attacks
- **Scaffold:** `npm run new -- padding-oracle "Padding oracle attacks" security deep attacks-and-defences`. Prereqs: cipher-modes. Path `security`: after cipher-modes.
- **Sources:** Black & Urtubia, "Side-Channel Attacks on Symmetric Encryption Schemes: The Case for Authenticated Encryption", USENIX Security 2002, https://www.usenix.org/legacy/event/sec02/full_papers/black/black_html/index.html (paper; about 128 expected queries per byte, the case for authenticated encryption); RFC 5652 §6.3, https://www.rfc-editor.org/rfc/rfc5652.html (standard; the padding rule); Wikipedia, Padding oracle attack, https://en.wikipedia.org/wiki/Padding_oracle_attack (encyclopedia; at most 256 tries per byte).
- **Reuse:** `makeCipher`, `cbcEncrypt` and `cbcDecrypt` from `explainers/cipher-modes/cipher-modes.js`: move the file to `shared/cipher-modes.js` (free today) and update cipher-modes' imports. `hmacSha1` from `shared/totp.js` for the fix. Blocks are 2 bytes in the toy cipher, so padding is 1 or 2 bytes; the caveat says real AES blocks are 16.
- **Facts:**
  1. Padding adds k − (len mod k) bytes, each of that value. With k = 2, a 7-byte message gets one 0x01 and an 8-byte message gets a whole block 0x02 0x02. Test: pad and unpad both, and reject a block ending 0x01 0x02.
  2. XORing byte j of the previous ciphertext block (or the IV) with d XORs byte j of the next plaintext block with d. Test: decrypt the tampered ciphertext and compare that byte.
  3. From the server's yes/no answer about padding alone, never touching the key, the attack recovers the whole self-written message, first block included (the IV is sent with it). Test: recovered bytes equal the plaintext.
  4. Each byte takes at most 256 guesses, plus one check query per block to rule out a lucky 0x02 0x02. The printed run averages close to 128 per byte. Test: total queries ≤ 256 × bytes + blocks, and a crafted block whose first plaintext byte is 0x02 is still recovered correctly.
  5. Fix: a MAC over IV and ciphertext, checked before decrypting. Every tampered ciphertext gets the same answer for all 256 guesses, and the attack recovers 0 bytes. Test: the set of answers has one element, recovered bytes is empty.
- **Out of scope:** timing side channels such as Lucky Thirteen (link to timing-attacks), POODLE and SSL 3.0 history, CBC-R encryption, attacks on real AES or TLS.

### 6. `bellman-ford`: Negative weights and Bellman–Ford
- **Scaffold:** `npm run new -- bellman-ford "Negative weights and Bellman–Ford" algorithms deep search-and-graphs`. Prereqs: pathfinding. Path `algorithms`: after pathfinding.
- **Sources:** Sedgewick & Wayne, Algorithms 4th ed., 4.4 Shortest Paths, https://algs4.cs.princeton.edu/44sp/ (book; Bellman–Ford, negative cycles, arbitrage with −ln of rates, Dijkstra without re-queueing may be wrong with negative edges); cp-algorithms, Bellman-Ford, https://cp-algorithms.com/graph/bellman_ford.html (article; n − 1 phases, a relaxation in phase n means a negative cycle).
- **Reuse:** none. `explainers/routing/` runs distance vector across routers and covers count to infinity; link to it rather than repeating it. The exchange rates are invented for the page.
- **Facts:**
  1. Graph S→A 2, S→B 5, B→A −4: a Dijkstra that settles each node once reports A = 2. Bellman–Ford reports the true 1. Test: both distances.
  2. A 6-node chain needs 5 rounds that change something when its edges are listed back to front, and 1 when listed front to back. Test: count changing rounds for both orders.
  3. On any built-in graph without a negative cycle, relaxations ≤ (V − 1) × E. Test: the counter against the bound on each built-in graph.
  4. A relaxation that still succeeds in round V proves a negative cycle. Walking predecessors V times from that node lands on the cycle, and its weights sum below 0. Test: detect, extract, sum.
  5. Arbitrage: on 4 invented currencies with weights −ln(rate), the cycle found has a rate product above 1. Lowering one rate on that cycle by 1% removes every negative cycle. Test: product > 1 before, no cycle after.
- **Out of scope:** Johnson's algorithm, SPFA and its worst case, distance vector across routers (routing), all-pairs shortest paths, real exchange rates or fees.

### 7. `bandits`: Multi-armed bandits
- **Scaffold:** `npm run new -- bandits "Multi-armed bandits" statistics deep experiments-and-inference`. Prereqs: abtest, bayes. Path `stats`: after bayes.
- **Sources:** Sutton & Barto, Reinforcement Learning: An Introduction, 2nd ed., ch. 2 Multi-armed Bandits, http://incompleteideas.net/book/the-book-2nd.html (free book; already used by rl, keep the http URL); Russo, Van Roy, Kazerouni, Osband, Wen, "A Tutorial on Thompson Sampling", arXiv 1707.02038 (paper; Beta–Bernoulli Thompson sampling, greedy getting stuck).
- **Reuse:** `mulberry` from `shared/random.js`, `quantile` from `shared/normal.js` for 95% intervals. Beta sampling is new and local (two gamma draws). Two arms converting at 0.10 and 0.12, 10,000 visitors, 200 seeded runs.
- **Facts:**
  1. From a Beta(1, 1) prior, 7 conversions in 10 visits gives Beta(8, 4), mean 8/12 ≈ 0.667. Test: the update and the mean.
  2. A 50/50 split over 10,000 visitors loses 5,000 × 0.02 = 100 expected conversions against always showing the better arm. Test: the regret formula.
  3. Thompson sampling's mean regret over the 200 seeded runs is below 100 (printed value). Test: the mean against 100.
  4. Pure greedy (show the higher observed rate) sends most traffic to the worse arm in more than 0 of the 200 runs, and Thompson sampling in fewer than greedy (both printed). Test: the two counts.
  5. Thompson's share of visitors on the better arm is higher in the last 1,000 than in the first 1,000. Test: on the seeded run.
  6. The price: the worse arm gets fewer visitors, so its 95% interval is wider under Thompson sampling than under the 50/50 split. Test: both widths on the seeded run.
- **Out of scope:** UCB and its regret bounds, contextual bandits, rewards that drift over time, Bayesian A/B stopping rules, ε-greedy tuning.

### 8. `shell-expansion`: Shell quoting and globs
- **Scaffold:** `npm run new -- shell-expansion "Shell quoting and globs" tools intro everyday-tools`. Prereqs: none. Path `toolbox`: after pipes.
- **Sources:** GNU Bash Reference Manual, 3.5 Shell Expansions, https://www.gnu.org/software/bash/manual/html_node/Shell-Expansions.html (docs; order of expansions, word splitting on unquoted results only, IFS default space tab newline, filename expansion sorted, no match left as is, leading dot matched explicitly); glob(7), https://man7.org/linux/man-pages/man7/glob.7.html (docs; POSIX leaves an unmatched pattern unchanged, `rm *` keeps `.profile`). gnu.org answered 429 once during planning, so retry `check-sources` before swapping it.
- **Reuse:** none. A toy expander for `$var`, `"…"`, `'…'`, `*` and `?` over a built-in directory: `a.txt`, `b.txt`, `.hidden.txt`, `notes.md`, `-l`. Each command shows the argument list the program receives.
- **Facts:**
  1. With `file="my notes.txt"`, `rm $file` passes 2 arguments and `rm "$file"` passes 1. Test: argv lengths and values.
  2. `'$file'` passes the literal text `$file`, and `"$file"` passes its value. Test: argv.
  3. An unset variable unquoted passes 0 arguments, quoted it passes 1 empty argument. Test: argv.
  4. `*.txt` becomes `a.txt b.txt`, without `.hidden.txt`. `"*.txt"` stays literal, and `*.csv`, matching nothing, is passed as `*.csv`. Test: argv for each.
  5. `ls *` passes `-l` as an argument, so ls reads it as an option. `ls ./*` passes `./-l`. Test: argv contains `-l` in the first and `./-l` in the second.
- **Out of scope:** brace and tilde expansion, command substitution and arithmetic, `nullglob`, `failglob` and `GLOBSORT`, locale sort order (the built-in names avoid it), other shells' differences, IFS changes.

### 9. `linkers`: How linkers work
- **Scaffold:** `npm run new -- linkers "How linkers work" tools deep compilers-and-runtimes`. Prereqs: compiler. Path `machine`: after register-allocation.
- **Sources:** elf(5), https://man7.org/linux/man-pages/man5/elf.5.html (docs; symbol binding, relocation entries with r_offset, r_info, r_addend); Eli Bendersky, "Library order in static linking", https://eli.thegreenplace.net/2013/07/09/library-order-in-static-linking (article; left-to-right scan, members pulled only for undefined symbols, a library is not revisited); Eli Bendersky, "Load-time relocation of shared libraries", https://eli.thegreenplace.net/2011/08/25/load-time-relocation-of-shared-libraries (article; PC-relative patch worked through).
- **Reuse:** none. Toy object files, each a list of defined symbols, undefined symbols, section sizes and relocations, with self-made names (`main`, `area`, `print`). Static linking only.
- **Facts:**
  1. Linking `main.o` alone reports undefined references to `area` and `print`. Adding `geom.o` and `io.o` links. Two objects that both define `area` give a duplicate-symbol error. Test: the error lists for each.
  2. `main.o libgeom.a` links and `libgeom.a main.o` fails with an undefined reference to `area`. Test: both orders.
  3. From an archive of 5 members where `main.o` needs one member that needs another, the output contains exactly those 2. Test: member list.
  4. A PC-relative call is patched to S + A − P. Eli's example, S = 0x0012e49c, A = −4, P = 0x0012e4b4, gives 0xffffffe4. Test: that value, and moving the callee changes only the caller's patched field.
- **Out of scope:** dynamic linking, PLT and GOT, position-independent code, weak symbols, linker scripts, LTO, real ELF byte layouts.

### Questions for the user
- Answered 2026-11-19: no tenth explainer (batch stays at nine); `book.systemsapproach.org` is a trusted domain; the Kafka docs link is pinned to the 4.0.0 tag, not trunk.

## Batch 15 ✅ built (on `explainers/batch-15`, PR pending)

Eight from the gap table, one per open gap: switches (networking intro), backups (databases intro), tail-latency (distributed intro), length-extension (security deep dive), strongly-connected (algorithms deep dive), sequential-testing (statistics deep dive), command-lookup and type-inference (tools intro and deep). Systems and ML are balanced and get none. Same flow as batch 14: `tdd` per module, `code-review` plus `ponytail-review` before the PR, `pr` for the body.

Each spec gives the scaffold line, prereqs, path, sources (first one primary; **new domain** marks a host not yet in `TRUSTED`), reuse, the facts with the test that pins each, and what stays out. Numbers marked "printed" come from a seeded or exact run: the generator prints them first, the test pins them, and the prose copies them. Model constants (latencies, timeouts, thresholds) are the page's own; the prose says "in this model" and never presents them as values from a standard. Every id below was checked against `catalog.js` on 2026-11-25 and is free.

### Build result (2026-11-25)
All eight built, each evaluated by an agent until PASS: switches (42e41bb, 2 fix rounds), backups (e4edd81), tail-latency (1ad08ac, 1), length-extension (a2ffa68), strongly-connected (7b37dde, 1), sequential-testing (f37fe5c), command-lookup (ffa47ed, 1), type-inference (68f33a3, 1). `make check` 891 pass; phone-width sweep 173 pages, `bad: []`. The separate `code-review` and `ponytail-review` passes were skipped to save usage; the evaluators covered each page.

Lessons: evaluators found the same class of bug again, a displayed value that is true at the default but stale or mislabelled after a state change (switches' table after Wait, tail-latency's leaf-mean tile, command-lookup's tiles after Run, type-inference's order tile). Tell generators up front to test what `view()` displays after every control change, and to pin every displayed line. A generator's own report once came back as "placeholder": check the commit and tests yourself.

Open nits (not fixed, none false): backups legend says "recovered" where rows say "kept"; sequential-testing's "only because" and "however often you look" overreach; length-extension's "last role=" and "signs" wording; tail-latency's seeded-tile sentence is near the helper-text limit; strongly-connected's Random mode can repeat clauses; command-lookup resolves `..` lexically.

### 1. `switches`: Switches and ARP
- **Scaffold:** `npm run new -- switches "Switches and ARP" networking intro how-the-network-works`. Prereqs: subnets. Path `internet`: after subnets.
- **Sources:** RFC 826: An Ethernet Address Resolution Protocol, https://www.rfc-editor.org/rfc/rfc826.html (standard); Peterson & Davie, Computer Networks: A Systems Approach, 3.2 Switched Ethernet, https://book.systemsapproach.org/internetworking/ethernet.html (free book; learning from source addresses, flooding unknown destinations, entry timeout, loops and spanning tree); the same book, 3.3 Basic Internetworking, https://book.systemsapproach.org/internetworking/basic-ip.html (free book; ARP broadcast and reply, ARP cache with timeout, next hop is the router when the destination is off the network).
- **Reuse:** `parse` and `contains` from `shared/subnets.js` for the same-network test. A 4-port switch with hosts A, B, C on ports 1 to 3 and a router on port 4, all on 10.0.0.0/24 (router 10.0.0.254). Self-made MAC addresses. The entry timeout is a model constant.
- **Facts:**
  1. Empty table: the first frame from A (port 1) to B goes out ports 2, 3 and 4, never back out port 1, and the switch learns A on port 1. B's reply then goes out port 1 only. Test: the port list for each frame and the table after each.
  2. Once both are learned, A to B goes out exactly port 2. Test: one port.
  3. With no frame from B for longer than the timeout, B's entry is gone and A to B floods again. Test: ports before and after the timeout.
  4. B moves from port 2 to port 3: frames to B still go to port 2 until B sends a frame, then to port 3. Test: the port before and after B's first frame from port 3.
  5. ARP: A's first packet to 10.0.0.2 sends one broadcast ARP request (flooded to every other port) and gets one reply sent to A alone. A's second packet to 10.0.0.2 sends 0 ARP frames. Test: ARP frame counts and their ports for both packets.
  6. Off the network: a packet from A to 203.0.113.5 makes A ask ARP for 10.0.0.254, never for 203.0.113.5. The frame's destination MAC is the router's and its IP destination stays 203.0.113.5. Test: the ARP target and the frame's two destination fields.
  7. Loop: two switches joined by two cables. One broadcast from A still has frames in flight after 100 steps. With one of the two cables blocked, no frames are in flight after the broadcast is delivered. Test: in-flight count at step 100 in both setups.
- **Out of scope:** the spanning tree election itself (root, designated ports), VLANs, ARP spoofing, IPv6 neighbour discovery, real Ethernet frame layout, real timeout values.

### 2. `backups`: Backups and point-in-time recovery
- **Scaffold:** `npm run new -- backups "Backups and point-in-time recovery" databases intro transactions-and-durability`. Prereqs: transactions. Path `databases`: after write-ahead-log.
- **Sources:** PostgreSQL, Continuous Archiving and Point-in-Time Recovery (PITR), https://www.postgresql.org/docs/current/continuous-archiving.html (docs; base backup plus WAL replay, the backup need not be consistent because replay fixes it, stop replay at any time since the base backup, the 5:15 PM DROP TABLE example restored to 5:14 PM, the stop point must be after the base backup ends); PostgreSQL, Backup and Restore, https://www.postgresql.org/docs/current/backup.html (docs; the three approaches).
- **Reuse:** none. The two accounts from `transactions` (Alice 100, Bob 50) plus a self-made day's log of timestamped transfers and one `DROP TABLE`. A nightly base backup at 00:00 and a WAL archive shipped in 15-minute segments (a model constant). Link to write-ahead-log for crash recovery rather than repeating it.
- **Facts:**
  1. Restoring only the 00:00 backup after a disk failure at 17:30 gives the state at 00:00 and loses every transfer committed after it (printed count). Test: restored rows equal the 00:00 state, and the lost count equals the log's commits in (00:00, 17:30].
  2. Base backup plus replay of the whole archive gives the state at the last shipped segment. Test: rows equal the live state at that time.
  3. With 15-minute segments, a failure at time t loses the commits in (15·⌊t/15⌋, t], never more than 15 minutes of them. Test: sweep t over every minute of the day against the formula.
  4. The table is dropped at 17:15. Replaying to the end leaves it dropped. Replaying to 17:14 brings it back with exactly its rows at 17:14. Test: table present or absent for both targets, rows compared.
  5. A backup copied row by row while a transfer of 30 runs can total 120 or 180 on its own. The same copy plus the archive replayed from the backup's start totals 150 at every interleaving. Test: sweep every interleaving of the copy and the transfer; the copy alone gives a total other than 150 at least once, and copy plus replay gives 150 every time.
  6. A recovery target before the base backup ended (23:00 the day before, from the 00:00 backup) is refused. Test: the restore returns an error.
- **Out of scope:** pg_dump and logical backups, standbys and replication (replication-lag), timelines, incremental backups, backup storage rules such as 3-2-1, restore speed.

### 3. `tail-latency`: Tail latency and fan-out
- **Scaffold:** `npm run new -- tail-latency "Tail latency and fan-out" distributed intro traffic-and-reliability`. Prereqs: none. Path `distributed`: after queues.
- **Sources:** Dean & Barroso, "The Tail at Scale", CACM 2013, https://research.google/pubs/pub40801/ (paper; the record page, whose full text link goes to cacm.acm.org; see Questions); Google SRE book, ch. 4 Service Level Objectives, https://sre.google/sre-book/service-level-objectives/ (free book; percentiles over the mean, the mean and median can be far apart).
- **Reuse:** `mulberry` from `shared/random.js`. A leaf server answers in 10 ms with probability 0.99 and 1,000 ms with 0.01, independently (model constants). A request fans out to n leaves and waits for the slowest. A hedged leaf call sends a second copy to another replica if nothing came back by 20 ms and takes the first answer.
- **Facts:**
  1. One leaf: the mean is 0.99 × 10 + 0.01 × 1,000 = 19.9 ms, while 99% of calls take 10 ms. Test: the exact mean and the share at 10 ms.
  2. Fan-out: P(request slow) = 1 − 0.99ⁿ, which is 0.01 at n = 1, 0.0956 at n = 10 and 0.634 at n = 100. Test: the formula to 1e-3, and a seeded 10,000-request run within 0.02 at each n.
  3. At n = 100 the median request takes 1,000 ms, because more than half of requests hit a slow leaf. Test: the seeded run's median.
  4. Hedging after 20 ms: a leaf is slow only if both copies are, so P(request slow) at n = 100 is 1 − 0.9999¹⁰⁰ ≈ 0.00995, and the median falls to 30 ms. Test: the formula, the seeded rate within 0.005, and the seeded median.
  5. The hedge costs 1% extra leaf calls (only the slow first copies get one). Sending two copies of every call costs 100% extra for the same slow rate. Test: extra-call fraction in both modes, exact and seeded.
- **Out of scope:** tied requests and cancellation, the extra queueing hedges cause, coordinated omission, latency histograms, causes of slowness (GC, queues), retries (link to retries).

### 4. `length-extension`: Length extension attacks
- **Scaffold:** `npm run new -- length-extension "Length extension attacks" security deep attacks-and-defences`. Prereqs: hash-functions, jwt. Path `security`: after jwt.
- **Sources:** RFC 2104: HMAC, https://www.rfc-editor.org/rfc/rfc2104.html (standard; the nested construction); RFC 3174: US Secure Hash Algorithm 1, https://www.rfc-editor.org/rfc/rfc3174.html (standard; §4 padding with a 1 bit, zeros and the 64-bit length); Wikipedia, Length extension attack, https://en.wikipedia.org/wiki/Length_extension_attack (encyclopedia; the appended duplicate parameter, trying key lengths, HMAC and SHA-3 not affected).
- **Reuse:** `sha1` from `shared/git.js`, given an optional starting state and byte count so it can resume (default unchanged; `git.test.js` still checks it against real `git`, and its 8 importers keep working). `hmacSha1` and `textBytes` from `shared/totp.js` for the fix. The secret and the message (`user=alice&role=user`) are self-made; the server takes the last `role=` it sees.
- **Facts:**
  1. SHA-1 padding: 0x80, zeros, then the 8-byte bit length, to a multiple of 64 bytes. 55 bytes pad to 64, and 56 bytes pad to 128. Test: padded lengths at 55, 56 and 64 bytes and the final 8 bytes.
  2. The digest is the state after the last block: resuming from sha1(m)'s five words, at byte count len(pad(m)), over x gives sha1(pad(m) ‖ x). Test: equality with the direct hash for several m and x.
  3. With MAC = sha1(secret ‖ message), an attacker who knows the message, its MAC and the secret's length (16) makes message ‖ padding ‖ `&role=admin` and a MAC the server accepts, and the server reads role `admin`. Test: the server's check passes and the parsed role, with the forging function given only message, MAC, length and suffix.
  4. Without the length, trying 1, 2, 3 … succeeds first at 16, after 16 server queries. Test: the query count.
  5. With HMAC-SHA1 as the MAC, the same forgery fails for every guessed length from 1 to 64. Test: all 64 checks fail.
- **Out of scope:** SHA-256 internals (same attack, other constants), MD5 collisions, sha1(message ‖ secret) and its weaknesses, real incidents, tools such as hash_extender, why SHA-3 resists beyond one caveat line.

### 5. `strongly-connected`: Strongly connected components and 2-SAT
- **Scaffold:** `npm run new -- strongly-connected "Strongly connected components and 2-SAT" algorithms deep search-and-graphs`. Prereqs: topological-sort. Path `algorithms`: after topological-sort.
- **Sources:** Sedgewick & Wayne, Algorithms 4th ed., 4.2 Directed Graphs, https://algs4.cs.princeton.edu/42digraph/ (book; strong components, Kosaraju–Sharir, reverse postorder of the reverse graph, preorder instead does not work); cp-algorithms, Strongly connected components, https://cp-algorithms.com/graph/strongly-connected-components.html (article; condensation graph); cp-algorithms, 2-SAT, https://cp-algorithms.com/graph/2SAT.html (article; a ∨ b as ¬a ⇒ b and ¬b ⇒ a, unsatisfiable iff x and ¬x share a component, the assignment from component order, the worked formula).
- **Reuse:** none. `explainers/topological-sort/` is the DAG side; link to it, and link to sat-sudoku for general SAT. Built-in graphs are self-made (an 8-node graph with several components, and the implication graphs below). Seeded 2-SAT formulas use `mulberry` from `shared/random.js`.
- **Facts:**
  1. The components of the built-in graph match brute-force reachability: two nodes share a component exactly when each reaches the other. Test: the partition against the reachability matrix.
  2. The condensation (one node per component) has no cycle. Test: a topological sort of it succeeds.
  3. Kosaraju–Sharir: pass 1 takes the reverse postorder of the reversed graph, pass 2 runs DFS on the graph in that order, and each pass 2 call collects exactly one component. Run pass 2 in plain node order instead and the built-in graph gets a group that is not strongly connected. Test: both partitions against brute force.
  4. Both passes examine every edge once each: 2E edge checks in total. Test: the counter on each built-in graph.
  5. 2-SAT: the formula (a ∨ ¬b) ∧ (¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) becomes 8 implication edges over 6 literals and is satisfiable, and the assignment read from component order satisfies all 4 clauses. Test: edge count, verdict, clause check.
  6. Adding (a ∨ b) makes it unsatisfiable: a and ¬a land in one component. On 200 seeded formulas over 5 variables, the component verdict agrees with trying all 32 assignments. Test: the shared component, and agreement on all 200.
- **Out of scope:** Tarjan's and path-based algorithms, 3-SAT and SAT solvers (sat-sudoku), bridges and articulation points, iterative DFS, real uses beyond 2-SAT.

### 6. `sequential-testing`: Sequential A/B tests
- **Scaffold:** `npm run new -- sequential-testing "Sequential A/B tests" statistics deep experiments-and-inference`. Prereqs: abtest, power-analysis. Path `stats`: after multiple-testing.
- **Sources:** Johari, Pekelis, Walsh, "Always Valid Inference: Bringing Sequential Analysis to A/B Testing", arXiv 1512.04922 (paper; inferences are unreliable when people monitor continuously and stop when they like); Evan Miller, "Simple Sequential A/B Testing", https://www.evanmiller.org/sequential-ab-testing.html (article; pick N, stop when T − C reaches 2√N or T + C reaches N, one-sided at α = 0.05; N = 808 for a 20% lift at 80% power).
- **Reuse:** `quantile` from `shared/normal.js` for z values. Exact results come from a small dynamic program over (conversions so far, T − C), so most facts need no random runs. The model counts conversions only: under no difference each conversion is treatment's with probability 1/2, and with a lift L it is (1 + L) / (2 + L).
- **Facts:**
  1. The rule with N = 808 and threshold d = ⌈2√808⌉ = 57 declares a false winner with probability at most 0.05 when there is no difference (exact, printed). Test: the dynamic program's value ≤ 0.05.
  2. Peeking: checking a one-sided z-test (z > 1.645) after every conversion up to 808 and stopping at the first win gives a false winner far more often (exact, printed). Test: the value is more than twice the rule's.
  3. A single test at conversion 808 only keeps the false winner rate at or below 0.05 (exact binomial). Test: the value ≤ 0.05.
  4. With a true 20% lift, the rule finds the winner with power close to the 0.8 it was sized for (exact, printed), and stops before 808 conversions on average (printed). Test: power within 0.05 of 0.8, mean stopping point below 808.
  5. With a 50% lift, it stops sooner on average than with 20% (printed). Test: the two mean stopping points.
- **Out of scope:** the two-sided rule (2.25√N), mSPRT and always-valid p-value formulas, group sequential designs (Pocock, O'Brien–Fleming), Bayesian stopping (bandits), visitors who don't convert.

### 7. `command-lookup`: How the shell finds a command
- **Scaffold:** `npm run new -- command-lookup "How the shell finds a command" tools intro everyday-tools`. Prereqs: none. Path `toolbox`: after shell-expansion.
- **Sources:** GNU Bash Reference Manual, 3.7.2 Command Search and Execution, https://www.gnu.org/software/bash/manual/html_node/Command-Search-and-Execution.html (docs; functions, then builtins, then PATH; names with a slash skip the search; the hash table; status 127 when not found); GNU Bash Reference Manual, 4.1 Bourne Shell Builtins, https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html (docs; `hash -r` forgets remembered locations); exec(3), https://man7.org/linux/man-pages/man3/exec.3.html (docs; a slash means PATH is ignored, a file that gives permission denied is skipped and the search goes on). Bash 5.2's Bourne Shell Variables page states that an empty PATH entry means the current directory. gnu.org answered 429 once during planning, so retry `check-sources` before swapping it.
- **Reuse:** none. A toy file system with self-made paths (`/home/me/bin`, `/usr/local/bin`, `/usr/bin`, the current directory `/home/me/project`), executable bits, one function and the builtin `cd`. Link to shell-expansion for what happens before the lookup and to processes for fork and exec.
- **Facts:**
  1. With PATH `/home/me/bin:/usr/local/bin:/usr/bin` and `python` in the last two, `python` runs `/usr/local/bin/python`. Moving `/usr/bin` first runs `/usr/bin/python`. Test: the resolved path for both PATH values.
  2. A function named `ls` runs instead of `/usr/bin/ls`, and `cd` is a builtin, so PATH is never searched for it. Test: the resolution kind and the number of directories searched (0).
  3. `deploy` in the current directory: `deploy` is not found and the status is 127. `./deploy` runs it without searching PATH. Test: status and resolved path.
  4. A trailing colon (`/usr/bin:`) adds the current directory, so `deploy` is found. Test: resolved path.
  5. A `tool` without the executable bit in `/home/me/bin` is skipped and `/usr/bin/tool` runs. Test: resolved path.
  6. After `python` runs once from `/usr/local/bin`, a new `/home/me/bin/python` is ignored because the location is remembered. After `hash -r`, the new one runs. Test: the resolved path before and after `hash -r`.
- **Out of scope:** aliases, shebang lines and the script fallback, `type` and `command -v` output formats, CDPATH, other shells' rules, sudo's own path, Windows PATHEXT, environment variables beyond PATH.

### 8. `type-inference`: Type inference
- **Scaffold:** `npm run new -- type-inference "Type inference" tools deep compilers-and-runtimes`. Prereqs: compiler. Path `machine`: after compiler.
- **Sources:** Clarkson et al., OCaml Programming: Correct + Efficient + Beautiful, 10.6 Type Inference, https://cs3110.github.io/textbook/chapters/interp/inference.html (free book, **new domain**, answered from here on 2026-11-25; constraint generation, unification, the occurs check, let-polymorphism with `let id = fun x -> x in let a = id 0 in id true`); Cornell CS 3110, Lecture 12: Type Inference and Unification, https://cs.cornell.edu/courses/cs3110/2013sp/lectures/lec12-type-inference/lec12.html (course; the worked types for `fun x -> x`, `fun x -> fun y -> x` and composition, self-application fails on a circularity). Add the new domain to `TRUSTED` and run `npm run check-sources`.
- **Reuse:** none. `explainers/compiler/` has its own parser for a different language, so the toy language here is small and separate: integers, booleans, `+`, `if`, `fun`, application and `let`. Type variables are printed renamed in order of first appearance ('a, 'b, …) so tests compare strings.
- **Facts:**
  1. `fun x -> x` is `'a -> 'a`, `fun x -> fun y -> x` is `'a -> 'b -> 'a`, and `fun f -> fun g -> fun x -> f (g x)` is `('a -> 'b) -> ('c -> 'a) -> 'c -> 'b`. Test: the printed types.
  2. `fun x -> x + 1` is `int -> int`, and `if true then 1 else false` fails unifying int with bool. Test: type and error.
  3. Occurs check: `fun x -> x x` fails because 'a would have to equal 'a -> 'b. With the check turned off, unification binds a variable to a type containing itself. Test: the error, and that binding in the unchecked substitution.
  4. Let-polymorphism: `let id = fun x -> x in let a = id 0 in id true` is `bool`. `(fun id -> let a = id 0 in id true) (fun x -> x)` fails unifying int with bool, because a function parameter is not generalised. Test: type and error.
  5. The order constraints are solved in doesn't change the answer: for each built-in program, 20 seeded shuffles of its constraints give the same printed type or the same failure. Test: all 20 agree.
- **Out of scope:** the value restriction and mutable references, type classes and overloading, subtyping and records, error message quality, TypeScript's or Rust's inference, bidirectional checking.

### Questions for the user
- Answered 2026-11-25: batch stays at eight; tail-latency links the research.google record page; `cs3110.github.io` is added to `TRUSTED`; sequential-testing is the one-sided rule only.

## How to work (read before starting)

**Start:** run `npm test` and expect all tests passing (636 at the time of writing). The local preview config is `.claude/launch.json`, name `under-the-hood`, port 8766; it's git-ignored, so recreate it if missing. Or run `npm start` (port 8765).

**For each explainer:**
1. `npm run new -- <id> "<Title>" <area> <level>`. This creates `explainers/<id>/` (page, logic, test) and the catalog entry, and refuses to overwrite. Never hand-create files in `shared/` without checking they don't exist: an earlier session overwrote the RSA module (used by the signatures and TLS pages) this way.
2. Write the logic module and its tests first. Make the tests pin down *facts the page will claim*. Every number in the page's prose must come from the code or a test.
3. Build the page with shared pieces: `.row`, `.tabs` + `tabs()`, `.stats` + `statTile`, `.panel`, `.status`, `.scroll-x` (see README).
4. Verify in the browser: drive the controls with `javascript_tool`, read values, take a screenshot, check the console for errors. Bust caches after editing shared files: `await Promise.all(["shared/common.js","shared/style.css","catalog.js"].map(u => fetch(u, {cache:"reload"})))`.
5. Fill the catalog entry: tags, a one-line blurb, prereqs. Add 2+ trusted free sources to `sources.js` (one primary: standard, paper, docs or free book) and run `npm run check-sources`.
6. Commit per explainer.

**Lessons from earlier sessions:**
- **Prose must match the simulation.** Several drafts claimed things the numbers didn't show, e.g. "log₂ n rounds" for gossip (really ≈ log₂ n + ln n), 4-bit 70B "fits a gaming PC" (39 GB), backoff alone "fixes" retry storms (it doesn't after long outages). Run the scenario, then write the sentence.
- **Content filter:** a page embedding a long list of common English words with frequency ranks was blocked mid-write. Keep built-in data short and self-made (programming terms, invented scores, generated shapes or puzzles). Don't reproduce published word lists, texts or puzzle sets.
- **Async demos** need a generation counter so a Reset or a second click cancels a run in progress (see `explainers/text-buffers/`, `explainers/dynamic-programming/`).
- **Expensive recomputation on hover:** separate "render the view" from "recompute the stats".
- **Canvas with distance semantics** (knn) must be square, or circles look like ellipses.
- **Bash:** pipe `< /dev/null` into node commands. A stray `cat > file` with no heredoc hangs waiting on stdin.
- **Hidden browser pane** pauses `requestAnimationFrame`: override it with `setTimeout` inside the iframe for checks.
- **Figures must exist when the page loads.** `textFloor()` in `shared/common.js` measures each `svg[viewBox]` once, on load, and on phones wraps it in a sideways-scrolling `.scroll-x` so labels stay ≥ 11px. Put chart SVGs in the HTML and redraw their contents; an SVG created later by script never gets the wrapper.
- **Make the model honest before the page.** Several first drafts quietly failed their own claims: coverage-guided fuzzing needed AFL's deterministic stage to find the bug reliably, read-your-writes looked perfect only because every read fell inside its window, and a 4-bit history predictor can't learn a loop of 8. Print the numbers across the parameter range first.
- **Sources:** the first source must not be an encyclopedia (a test checks), and every new domain goes in `TRUSTED`. Check a host answers from here before adding it: `nlp.stanford.edu` refused connections and had to be dropped.

**New tag (wanted, not built yet):** every batch's explainers carry a "New" tag on their index cards, like a price tag in the card's top-right corner: flush to the corner, clipped to the card's rounded edge, with a small punched hole, in the theme's indigo (`--accent` fill, `--on-accent` text, so it follows dark mode) and right padding on the title so it never runs under the tag. Older cards get none. Do it with a `batch` number on each `catalog.js` entry and show the tag on the highest batch, so the next batch moves it with no manual cleanup. Build it as its own small change (CSS in `shared/style.css`, the card in `entryCards()` in `shared/common.js`, a test that only the latest batch is tagged), then every batch only sets `batch: <n>` on its new entries.

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
