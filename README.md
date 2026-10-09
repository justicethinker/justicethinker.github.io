# justicethinker.github.io

The personal site of **Emmanuel Isaac** — physicist, developer, debater. Ten static
pages, one accent colour, one generated drawing, and no third-party requests.

## Stack

| | |
|---|---|
| Framework | Astro 4 (`output: 'static'`) |
| Styling | Plain CSS, five source sheets, bundled to one file. No preprocessor, no utility framework |
| Client JS | One hand-written script — 3.3 kB, 1.4 kB gzipped |
| Fonts | Instrument Serif, self-hosted (2 files, 42 kB). Body text uses the platform's UI sans |
| Image | One drawing, generated in Node from the wave equation, encoded with `ffmpeg-static` |
| Hosting | GitHub Pages, deployed by Actions on push to `main` |

## Design

Paper and ink. The field is a warm off-white (`#f7f5f1`), the text a warm
near-black (`#1b1815`), and there is exactly one accent — a muted vermilion
(`#a4472c`) spent only on links, the current page and focus rings.

Structure is drawn with 1px hairlines at 13% ink: no cards, no panels, no
shadows. Lists are lists. The masthead carries four links; everything else waits
in the menu or the footer. The reasoning, and the rules this site is held to, are
in [`design/PAPER.md`](design/PAPER.md).

Two typefaces' worth of work is done by one shipped font: Instrument Serif for
display, the platform's own interface sans for everything else — it is excellent
everywhere, costs nothing to download, and cannot flash or fail.

## Layout of the source

```text
src/
  data/site.ts          every word on the site, typed — the single content source
  layouts/Layout.astro  head, meta, fonts, masthead, footer
  components/           Nav.astro, Footer.astro, Figure.astro
  pages/                index, physics, programming, speaking, work (projects),
                        blog, cv, about, contact, 404
  scripts/motion.js     reveals, menu, back-to-top, contact form
  styles/
    tokens.css          paper, ink, one accent, type scale, spacing
    fonts.css           the self-hosted display face
    base.css            reset, document type, links, focus, utilities
    components.css      masthead, menu, lists, facts, figure, form, footer
    motion.css          one gesture: a 10px settle, once, respecting reduced motion
```

## Commands

```bash
npm run dev        # development server
npm run build      # static build into dist/
npm run preview    # serve the built output

npm run image      # regenerate the one drawing, public/art/ink.webp
npm run og         # the 1200×630 social card, rendered in a real browser
npm run fonts      # refetch the self-hosted display face

npm run check      # page audit + interaction tests against dist/
```

## The one image

Every image is generated. The interference field — a few emitters summed into one
scalar value — is drawn as ink contours on paper: fine lines where the field is
steep, open curves where it is flat. `tools/ink.mjs` does the drawing;
`tools/gen-image.mjs` renders it to `public/art/ink.webp` (1600×1000, 110 kB).

It appears as a still in two places — a full-bleed plate on the home page, and
beside the modelling notes on the physics page. There is no video, no loop and no
autoplaying media anywhere on the site, which is a deliberate choice: the same
drawing animated cost between two and nine megabytes for a drift a visitor
watches for two seconds. The still carries the same idea for a tenth of that.

## Verification

Three tools, all driving a real headless Chromium over the DevTools protocol:

- **`npm run check`** — `tools/audit.mjs` walks all ten pages at four widths
  checking console and page errors, failed requests, horizontal overflow, that
  every image actually loaded, that the display font resolved, contrast, heading
  structure, tap-target sizes, and that nothing is left invisible by the reveal
  system. `tools/check-interactions.mjs` then drives the real controls — the
  drawing and its caption, the menu with its focus handling, the contact form
  including an empty submit, and back-to-top — and asserts observable behaviour.
- **`tools/diag-reveal.mjs`** — scrolls a page step by step, logging how many
  reveal targets light, which separates a broken reveal from a measurement
  artefact.
- **`tools/shoot.mjs` + `tools/preview-shots.mjs`** — full-page screenshots at any
  viewport, and downscaled or sliced previews for reviewing composition.

Two traps worth knowing about, both of which produced false alarms before they
were understood. The page uses `scroll-behavior: smooth`, so a test that scrolls
programmatically must pass `behavior: 'instant'` or it will sample positions the
page has not reached. And reveals take ~700 ms, so a probe that measures
immediately after scrolling reports lit content as invisible; the audit waits for
finite CSS animations to settle first.

## Editing content

Almost every change is an edit to [`src/data/site.ts`](src/data/site.ts) —
identity, projects, publications, talks, posts, record, education, skills and
statistics all live there, typed. Adding a project means adding an object to
`projects`; the work page, the discipline pages and the counts follow from it.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`dist/` to the `gh-pages` branch. CI installs production dependencies only
(`npm ci --omit=dev`); the image and social-card pipeline is local-only, and its
one binary download is the step most likely to fail for reasons unrelated to the
site — the build was verified to succeed with `ffmpeg-static` absent.

`public/.nojekyll` keeps GitHub Pages from filtering the `_astro/` directory.
