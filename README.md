# How it works

Interactive explainers for the machinery under computing: systems, networking, security, algorithms,
distributed systems, data science and machine learning. Static site, no build step, no dependencies.

## Run

    npm start        # serves on http://localhost:8765 (ES modules need http, not file://)
    npm test         # unit tests for all simulation logic (Node 20+)

## Layout

- `catalog.js`: the single source of truth for which explainers exist (area, level, tags, prerequisites).
  The home page, search, header breadcrumb and "Keep exploring" links are all generated from it.
- `index.html`: grouped, searchable home page (`?q=` and `?area=` are shareable).
- `style.css`, `common.js`: shared theme (light/dark), header/footer, related links, tiny DOM helpers.
- `<id>.html`: one page per explainer (UI and rendering only).
- `lib/*.js`: pure, DOM-free logic for each simulation. This is what the tests cover.
  - `lib/autograd.js` is a small reverse-mode autodiff engine plus MLP, shared by the ML pages.
    `trainStepFast` is a hand-written array backprop used for speed, tested to match autograd exactly.
- `tests/*.test.js`: `node:test` suites. `catalog.test.js` checks every catalog entry has a page (and
  vice versa), prerequisites exist and have no cycles. `git.test.js` checks hashes against real `git`.

## Adding an explainer

```bash
npm run new -- foo "Foo explained" algorithms core
```

This creates `foo.html`, `lib/foo.js`, `tests/foo.test.js` and a catalog entry, and refuses to overwrite
anything that already exists. Then:

1. Write the logic in `lib/foo.js` with no DOM access, and test it in `tests/foo.test.js`.
2. Fill in `foo.html`: the interactive part, then the "How it works" text.
3. Fill in the entry's tags, blurb and prereqs in `catalog.js`. `npm test` fails until the page and the entry agree.

Shared building blocks, so pages only carry what's unique to them:
- CSS in `style.css`: `.panel`, `.controls`, `.row`, `.tabs` (pressed state), `.stats`/`.stat` tiles
  (set `--stat-min` on `.stats` to change tile width), `.status`, `.scroll-x`, `label.inline`.
- JS in `common.js`: `chrome()`, `$`, `svgEl`, `sleep`, `escapeHtml`, `statTile` (one stat tile, for
  `items.map(statTile)`), and `tabs(el, options, active, onPick)`.

## Conventions

- Everything runs client-side and is deterministic per seed where randomness is involved.
- Colours come from CSS variables in `style.css`, so every page works in light and dark mode.
- Pages must fit a 360px-wide phone with no sideways scroll. Wide tables and diagrams go in `.scroll-x`.
- Simplifications are stated on each page (look for the small grey note at the bottom).
