---
name: batch
description: The delivery loop for one batch of explainers, from plan to reviewed PR, using the planner, generator and evaluator agents. Use when the user says "next batch", "/batch", "plan a batch" or "build the batch".
---

# Batch workflow

One batch = one branch `explainers/batch-<n>` = one PR into `main`. You (the main session) orchestrate; agents do focused work and report back. Stop and ask the user at every **Gate**.

Each agent ends its report by answering its own question (in its file). A phase moves on only when that answer is concrete: a named test, a command and its output, a `file:line`. "Should be fine" sends the work back.

## 1. Start

- `make context`. If ROADMAP.md already has a "Next batch" with unbuilt explainers, resume it and skip to Build.
- Otherwise `git fetch origin && git switch -c explainers/batch-<n> --no-track origin/main`.

## 2. Plan

- Run the **planner** agent.
- **Gate:** show the user each explainer's id, level, path, the facts it will claim, and the planner's Questions. Continue on their OK; fold their answers into ROADMAP.md.

## 3. Build (per explainer, oldest first)

- Run the **generator** with the explainer's id and its ROADMAP entry verbatim; don't make it re-plan.
- Run the **evaluator** on that explainer. It records the commit it reviewed.
- On FAIL, send the bug list to the generator verbatim, then re-run the evaluator. **Two fix rounds maximum**; after that, stop and show the user what remains.
- Concurrency per CLAUDE.md: one generator and at most one planner or evaluator at a time, in this checkout. The evaluator can review explainer *k* while the generator builds *k+1*.
- An agent's "done" is not proof: read the diff and the evaluator's command output yourself.

## 4. Sweep

- With the generator done and the tree clean, run `make check` once on the whole batch.
- Run the browser sweep from ROADMAP.md "How to work" (the evaluator has no browser) and look at each new page at phone width. Expect `bad: []`.

## 5. Ship

- Update ROADMAP.md: mark the batch done, update the gap table, fold durable lessons into "How to work".
- Tag the batch's explainers "New" on the index cards, and move the tag off the previous batch (see ROADMAP.md "New tag").
- Review the branch with `/mattpocock-skills:code-review` and `/ponytail-review`; fix what they confirm.
- **Gate:** summarise the batch (explainers, tests added, evaluator verdicts with SHAs, sweep result, anything skipped) and ask to push and open the PR.
- Push (the pre-push hook runs `make check`) and open the PR with the body from `/pr`. Merge only on the user's word.
- Afterwards, `/retro`.
