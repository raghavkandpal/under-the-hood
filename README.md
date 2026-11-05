# How it works

Interactive explainers for the machinery under computing: systems, networking, security, algorithms,
distributed systems, data science and machine learning. Static site, no build step, no dependencies.

## Run

    npm start        # serves on http://localhost:8765 (ES modules need http, not file://)
    npm test         # all tests: simulation logic, catalog and links (Node 22+)

## Layout

```
index.html                 home page: search, area filters, cards / concept map (?q= ?area= ?view= are shareable)
catalog.js                 the single list of explainers: area, level, tags, prerequisites
explainers/<id>/
  index.html               the page, served at /explainers/<id>/ (UI and rendering only)
  <name>.js                its DOM-free simulation logic
  <name>.test.js           tests for that logic
shared/
  style.css, common.js     theme (light/dark), header/footer, related links, small DOM helpers
  random.js                seeded random numbers (mulberry32), so demos and tests are reproducible
  autograd.js, git.js, …   logic used by more than one explainer
tests/                     site-wide checks: catalog ↔ pages, links, prerequisite graph
scripts/new.js             scaffolds a new explainer
```

- `catalog.js` drives the home page, search, header breadcrumb and "Keep exploring" links.
- Logic used by one explainer lives in its folder. It moves to `shared/` only once a second explainer needs it.
- `shared/autograd.js` is a small reverse-mode autodiff engine plus MLP for the ML pages. `trainStepFast`
  is a hand-written array backprop used for speed, tested to match autograd exactly. `git.test.js` checks
  hashes against real `git`.
- `npm test` runs every `*.test.js` in the repo.

## Adding an explainer

```bash
npm run new -- foo "Foo explained" algorithms core
```

This creates `explainers/foo/` with `index.html`, `foo.js` and `foo.test.js`, plus a catalog entry, and
refuses to overwrite anything that already exists. Then:

1. Write the logic in `foo.js` with no DOM access, and test it in `foo.test.js`.
2. Fill in `index.html`: the interactive part, then the "How it works" text.
3. Fill in the entry's tags, blurb and prereqs in `catalog.js`. `npm test` fails until the page and the entry agree.

Shared building blocks, so pages only carry what's unique to them:
- CSS in `shared/style.css`: `.panel`, `.controls`, `.row`, `.tabs` (pressed state), `.stats`/`.stat` tiles
  (set `--stat-min` on `.stats` to change tile width), `.status`, `.scroll-x`, `label.inline`.
- JS in `shared/common.js`: `chrome()`, `$`, `svgEl`, `sleep`, `escapeHtml`, `statTile` (one stat tile,
  for `items.map(statTile)`), `tabs(el, options, active, onPick)`, and `linkTo(entry)` for links to other
  explainers that work from any page.
- Links between explainers in page text are relative: `<a href="../tls/">TLS</a>`.

## Conventions

- Everything runs client-side and is deterministic per seed where randomness is involved.
- Colours come from CSS variables in `shared/style.css`, so every page works in light and dark mode.
- Pages must fit a 360px-wide phone with no sideways scroll. Wide tables and diagrams go in `.scroll-x`.
- Simplifications are stated on each page (look for the small grey note at the bottom).

See [ROADMAP.md](ROADMAP.md) for planned explainers and working notes.
