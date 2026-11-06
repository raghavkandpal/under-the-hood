# How it works

Interactive explainers for the machinery under computing: systems, networking, security, algorithms,
distributed systems, data science and machine learning. Static site, no build step, no dependencies.

## Site

Live at **https://raghavkandpal.github.io/under-the-hood/**, served by GitHub Pages straight from `main`
(no build step; `.nojekyll` tells Pages to serve the files as they are).

GitHub Actions runs `npm test` on every push and pull request, and fetches every further-reading link weekly.

## Run

    npm start        # serves on http://localhost:8765 with caching off, so a reload shows your edits
    npm test         # all tests: simulation logic, catalog and links (Node 22+)

## Layout

```
index.html                 home page: learning paths, search, area filters, cards by topic / concept map
                           (?q= ?area= ?view= and #topic-<id> / #path-<id> are shareable)
sources.js                 further reading for every explainer: trusted, free sources (npm run check-sources)
catalog.js                 the single list of explainers (area, topic, level, tags, prerequisites),
                           the areas with their topics, and PATHS (curated learning paths)
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

- `catalog.js` drives the home page, search, the Area › Topic breadcrumb, "Keep exploring" links and learning-path
  navigation. Opening a page with `?path=<id>` shows that path's progress bar and next step; which explainers a
  reader has opened is remembered in their browser only.
- Logic used by one explainer lives in its folder. It moves to `shared/` only once a second explainer needs it.
- `shared/autograd.js` is a small reverse-mode autodiff engine plus MLP for the ML pages. `trainStepFast`
  is a hand-written array backprop used for speed, tested to match autograd exactly. `git.test.js` checks
  hashes against real `git`.
- `npm test` runs every `*.test.js` in the repo.

## Adding an explainer

```bash
npm run new -- foo "Foo explained" algorithms core data-structures
```

This creates `explainers/foo/` with `index.html`, `foo.js` and `foo.test.js`, plus a catalog entry in that
area and topic (the topic defaults to the area's first), and refuses to overwrite anything that already exists. Then:

1. Write the logic in `foo.js` with no DOM access, and test it in `foo.test.js`.
2. Fill in `index.html`: the interactive part, then the "How it works" text.
3. Fill in the entry's tags, blurb and prereqs in `catalog.js`. `npm test` fails until the page and the entry agree.
4. If it belongs in a learning path, add its id to that path's `steps` in `PATHS`, after its prerequisites.
5. Add at least two sources to `sources.js`: a primary one (standard, paper, official docs or free book) and an
   approachable one. Only free-to-read sites from the `TRUSTED` list; `npm run check-sources` confirms every link loads.

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
