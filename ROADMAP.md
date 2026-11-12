# Roadmap

Plan for the next explainers, plus the working notes a new session needs. 145 explainers exist today, in 9 areas, 29 topics and 11 learning paths, each with free further reading.

## Where the gaps are

Areas and topics after batch 11 (135 explainers). Each explainer has an area and a topic in `catalog.js`; `PATHS` lists learning paths.

| Area | Count | Intro / Core / Deep | Topics | Gap |
|---|---|---|---|---|
| Systems: hardware & OS | 15 | 6 / 7 / 2 | Numbers & text, Memory, Operating systems, The processor | SIMD, interrupts & syscalls in depth |
| Networking & the web | 10 | 2 / 8 / 0 | How the network works, The web | **no deep dive**: QUIC in depth, BGP, Wi-Fi |
| Databases & storage | 10 | 1 / 5 / 4 | Storage engines, Queries, Transactions & durability | more intro (what an index is), vector search |
| Distributed systems | 17 | 1 / 12 / 4 | Traffic & reliability, Spreading data, Agreement, Time & order | **one intro**; Paxos, exactly-once streams |
| Security & cryptography | 13 | 5 / 6 / 2 | Building blocks, Protocols, Attacks & defences | JWTs, passkeys/WebAuthn, timing attacks |
| Algorithms & data structures | 25 | 8 / 14 / 3 | Foundations, Data structures, Search & graphs, Compression & signals | tries vs suffix arrays, max flow |
| Machine learning & AI | 23 | 8 / 11 / 4 | Classic ML, Neural networks, Language models | logistic regression, RLHF, mixture of experts |
| Statistics & probability | 10 | 6 / 3 / 1 | Probability, Experiments & inference | power analysis, survival curves |
| Developer tools | 12 | 1 / 10 / 1 | Version control, Building & shipping, Compilers & runtimes, Everyday tools | **one intro**; debuggers, three-way merge |

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

## Next batch (in progress on `explainers/batch-13`)

**Status (2026-11-12, session ended at its limit):**
- **Done** (evaluated, fixed, checked in the browser at 360px): quic, passkeys, paxos.
- **mixture-of-experts:** the re-evaluation found only minor items. Fix next session: say the busiest share "falls much further" with the loss (it also falls with the loss off); pin seed 1's ordering across weights; scale the load bars to the run's maximum load, since step 10 at weight None clips; give `#k`/`#kp` `role="group"`; compute each weight's 30-seed runs once (the test takes 10 s); rename "never drops more".
- **rlhf:** evaluator fixes committed in 7f41289 (honest framing, Pairs readout as an 8-seed mean, tighter brackets, seed-3 test). Next: re-evaluate it and check it in the browser.
- **tries-vs-suffix-arrays:** built (120914b), not yet evaluated. In the browser the `n` slider still shows on the banana and terms texts, because `hidden` on a `label.inline` gets overridden by its display rule.
- **Not started:** simd, debuggers, survival-curves, what-is-an-index.
- **Before the PR:** squash-merge. Intermediate commits a811fd5 and 5a4c5c4 fail tests on their own, because concurrent agents shared one working tree. Update the gap table and "145 explainers", and drop the stale line "No explainer imports from another explainer's folder" (quic's test imports http-versions). Then run code-review, ponytail-review and the final sweep.
- **After this batch merges:** deploy on GitHub Pages (from `main`, as before). No other host.
- **Lessons for the generator prompt:** run builds one at a time, or use worktrees, so commits don't absorb each other's hunks. Pin the page's own seed and control values, not only seed averages. Never tune a model until a claim holds and then state the claim as general.


Ten picked from the gap table for the next session: quic (networking deep dive), passkeys (security), paxos (distributed), mixture-of-experts and rlhf (ML), tries-vs-suffix-arrays (algorithms), simd (systems), debuggers (tools), survival-curves (statistics), what-is-an-index (databases intro). Same flow as batch 12: `tdd` per module, `code-review` plus `ponytail-review` before the PR, `pr` for the body.

Each spec gives the scaffold line, prereqs, where it goes in `PATHS`, sources (first one primary; **new domain** marks a host not yet in `TRUSTED`, so add it and run `npm run check-sources`, or use the listed fallback), what to reuse, and the facts. Every fact is a test: write it first, print the numbers across the parameter range, and copy prose numbers from the output. No explainer imports from another explainer's folder today, so reusing a module means moving it to `shared/` first (check the file name is free).

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
