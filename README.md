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
    npm run text-budget   # helper-text words per page, worst first (see Text below)

## Layout

```
index.html                 home page: search, area filter, learning paths, cards by topic / concept map
path/index.html            a learning path's introduction, steps and progress (path/?id=llms); path/ lists them all
                           (?q= ?area= ?view= and #topic-<id> / #path-<id> are shareable)
sources.js                 further reading for every explainer: trusted, free sources (npm run check-sources)
catalog.js                 the single list of explainers (area, topic, level, tags, prerequisites),
                           the areas with their topics, and PATHS (curated learning paths)
explainers/<id>/
  index.html               the page, served at /explainers/<id>/ (UI and rendering only)
  <name>.js                its DOM-free simulation logic
  <name>.test.js           tests for that logic
shared/
  style.css, common.js     theme (light/dark), header, sidebar, path bar, related links, small DOM helpers
  random.js                seeded random numbers (mulberry32), so demos and tests are reproducible
  autograd.js, git.js, …   logic used by more than one explainer
tests/                     site-wide checks: catalog ↔ pages, links, prerequisite graph
scripts/new.js             scaffolds a new explainer
```

- Every page gets a sidebar (built in `shared/common.js`): the current path's steps, the area's topics, "On this page"
  and the list of paths. It's a sticky column from 1180px wide and a drawer behind the Browse button below that.
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
6. Check the page against [Text](#text), then record its helper-text count with `npm run text-budget -- --update`.

Shared building blocks, so pages only carry what's unique to them:
- CSS in `shared/style.css`: `.panel`, `.controls`, `.row`, `.tabs` (pressed state), `.seg` (segmented control:
  one bordered group of `aria-pressed` buttons), `.stats`/`.stat` tiles (set `--stat-min` on `.stats` to change
  tile width), `.legend` (colour key: `<ul class="legend"><li><i style="--c:var(--red)"></i>lost</li></ul>`),
  `.status` (live readout), `.caveat`, `.cards`/`.card` (explainer cards), `.list` (dense rows of links), `.scroll-x`, `label.inline`, `.sr-only`.
- JS in `shared/common.js`: `chrome()`, `$`, `svgEl`, `sleep`, `escapeHtml`, `statTile` (one stat tile,
  for `items.map(statTile)`), `tabs(el, options, active, onPick)`, `entryCards(entries)` (a grid of explainer cards),
  and `linkTo(entry)` for links to other explainers that work from any page.
- Links between explainers in page text are relative: `<a href="../tls/">TLS</a>`.

## Conventions

- Everything runs client-side and is deterministic per seed where randomness is involved.
- Colours come from CSS variables in `shared/style.css`, so every page works in light and dark mode. Pages start in the
  system's theme and readers can switch between light and dark from the header; canvas code must ask `isDark()` and redraw in `onThemeChange()` (from `shared/common.js`),
  never query `prefers-color-scheme` itself (a test enforces this). Every page loads `shared/theme.js` in `<head>`.
- Pages must fit a 360px-wide phone with no sideways scroll. Wide tables and diagrams go in `.scroll-x`.
- Simplifications are stated on each page, in one `<p class="caveat">` at the end of the prose.

## Text

The site aims to read like a calm product UI. The interactive part of a page explains itself through its
layout; explanation lives in the prose under the `<h2>`s. If a control needs a sentence to make sense,
change the control (shorter label with its value inline, better default, a `.legend`, button text that
says what happens) rather than adding the sentence.

Allowed:
- `<h1>`, one lede paragraph (a sentence or two), `<h2>` section headings and the prose under them.
- Short control labels: one to three words, with the current value inline (`Servers 4`, `Power 80%`).
- Live readouts in `.status` that a script writes: step counters, results, errors. They start empty.
- A `.legend` for colours and line styles, one or two words per entry.
- One `.caveat` per page, at most about two sentences.
- A `.note` in the prose with a "Try it" experiment (a guided thing to do, not instructions for a control).
- Text only screen readers need goes in `aria-label`, `<title>`/`<desc>` in SVG, or `.sr-only`.

Not allowed:
- Taglines, footers, "helper" paragraphs describing what a control does or how to use it ("Click a cell to…",
  "Drag the slider…", "(edit any number)"), and prose descriptions of colours ("grey = …, orange = …").
- Secondary labels and meta lines: category pills, uppercase tags, "Part n of m" next to a visible progress
  indicator, counts that repeat what the list shows.
- Borders, pills and boxes used only for decoration. One accent colour (`--accent`); `--blue`, `--green` and
  `--red` carry meaning in diagrams only.

`tests/text-budget.test.js` keeps a per-page count of helper text (static `.status`, label, `<small>`, `.note` and `.legend`
words, fixed sentences scripts write into `.status`, and the caveat) in
`tests/text-budget.json`. A page may never go over its count. When you cut text, run
`npm run text-budget -- --update` so the drop shows in the diff. A new page starts at whatever it has,
which should be close to zero.

See [ROADMAP.md](ROADMAP.md) for planned explainers and working notes.
