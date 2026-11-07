# under-the-hood

Interactive explainers; a static site with no build step. [README.md](README.md) is the contract: layout, how to add an explainer, conventions, and the Text rules. [ROADMAP.md](ROADMAP.md) has the plan, the gap table and working lessons; read its "How to work" before starting a batch.

## Workflow

- **New explainer:** `npm run new -- <id> "<Title>" <area> <level> [topic]`. Write the logic and its tests first (`/tdd`): the tests pin down every fact the page will claim. Then the page, the catalog entry, 2+ sources, and `npm run text-budget -- --update`.
- **Smallest diff:** reuse `shared/` helpers and the shared CSS classes before writing anything new. Logic moves to `shared/` only once a second explainer needs it.
- **Before committing:** `npm test`, `npm run check-sources` when `sources.js` changed, and the browser sweep in ROADMAP.md.
- **Before a PR:** review the branch against the README rules with the plugin's code review (`/mattpocock-skills:code-review`, since the built-in `/code-review` shares the name), then write the body with `/pr`. One branch and one PR per batch.
- **A simulation gives wrong numbers:** `/diagnosing-bugs`.
- **Work bigger than one session:** `/to-spec` then `/to-tickets` into GitHub issues, or `/wayfinder` for a long open-ended stretch.
- **After a batch:** `/retro`, and fold anything durable into ROADMAP.md's lessons.
- **Unsure which skill fits:** `/ask-matt`.

## Agent skills

### Issue tracker

GitHub Issues on `raghavkandpal/under-the-hood`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); only `wontfix` exists on GitHub yet. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created when first needed. See `docs/agents/domain.md`.
