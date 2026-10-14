# justicethinker

The personal site of **Justice Thinker** (Emmanuel Isaac) — software, physics and
competitive debate.

Five sections and nothing else: **Me · Tech · Debate · Writing · Physics**, plus a
404. A gold-on-black design with a 3D particle field on the home page, real
pointer-driven tilt on every card, and a wave-interference tank you can drag.

## Stack

| | |
|---|---|
| Framework | Astro 4 (`output: 'static'`) |
| Styling | Plain CSS, five source sheets bundled to one file |
| 3D | three.js from a CDN via import map (home page only). Everything else is hand-written |
| Physics | Two hand-written simulators — the hero field and the wave tank |
| Fonts | Instrument Serif, self-hosted (2 files, 42 kB). Body text uses the platform UI sans |
| Hosting | GitHub Pages |

## Layout of the source

```text
src/
  data/site.ts            every word on the site, typed — the single content source
  layouts/Layout.astro    head, meta, fonts, import map, masthead, footer
  components/             Nav.astro, Footer.astro, Portrait.astro
  pages/                  index (Me), tech, debate, writing, physics, 404
  scripts/
    motion.js             reveals, the menu, 3D tilt, back-to-top
    hero.js               the home particle field and its integrator
    wave.js               the wave-interference tank
  styles/
    tokens.css            black, coals, one gold, silver-white, type, spacing
    fonts.css             the self-hosted display face
    base.css              reset, type, links, focus, layout
    components.css        masthead, hero, portrait, cards, footer, lab
    motion.css            one settle, stagger, tilt, reduced-motion handling
```

## Editing your content

Almost everything lives in [`src/data/site.ts`](src/data/site.ts):

- `identity` — name, role, email, GitHub, Substack, LinkedIn
- `techFeatured` / `techMore` — the repos shown on the Tech page
- `debateResults`, `talks`, `debateRules` — the Debate page
- `essays` — the Writing page; each entry links to its Substack post
- `physicsInterests`, `background` — the Physics page

Add a repo, add an essay, change a placing: the pages follow from that file.

## Your photograph

The home page has a framed seat waiting for one picture. Add `portrait.jpg` to
`public/` (portrait orientation, ~800×1000 or larger) and it appears in the gold
frame automatically — the build detects the file, so nothing requests a missing
image. Without it, a JT monogram holds the frame.

## Commands

```bash
npm run dev        # development server
npm run build      # static build into dist/
npm run preview    # serve the built output

npm run og         # regenerate the social card, public/og.jpg
npm run fonts      # refetch the self-hosted display face

npm run check      # page audit + interaction checks against dist/
npm run probe      # does the hero field actually render? (measures pixels)
```

## The physics

Both simulations are written by hand, with no physics library.

**The hero field** (`src/scripts/hero.js`) holds ~700 particles. Each hangs off
an anchor on a soft spring, loses energy to damping, and is pushed radially away
from the pointer inside a small radius. Neighbours within a short distance are
joined by faint gold lines. The integrator is semi-implicit Euler, one substep
per frame. A wireframe icosahedron turns at the centre.

**The wave tank** (`src/scripts/wave.js`) sums two or three emitters across a
coarse grid and draws the result as gold on black. Drag an emitter, change the
frequency, add or remove a source. Double-click pauses it.

Both are decoration: if three.js is unreachable or WebGL is unavailable, the hero
still reads over its gradient, and the tank has no external dependency at all.
Under `prefers-reduced-motion` each renders one composed frame and stops.

## Verification

Two tools, both driving a real headless Chromium over the DevTools protocol:

- **`npm run check`** — the audit walks all six pages at four widths and checks
  console and page errors, failed requests, horizontal overflow, that images
  loaded, that the display font resolved, contrast, heading structure, tap-target
  sizes, and that nothing is left invisible by the reveal system. The interaction
  pass then drives the real controls: the hero's WebGL context and frame counter,
  the 3D tilt transform, the menu with its focus handling, the wave tank's
  buttons and its actual pixels, and back-to-top.
- **`npm run probe`** — a canvas element with a live WebGL context is not proof of
  a drawing. This screenshots the hero region and counts bright pixels with
  ffmpeg, so a field that never renders fails instead of passing.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`dist/` to the `gh-pages` branch. CI installs production dependencies only
(`npm ci --omit=dev`); the social card and probe tooling are local-only.

`public/.nojekyll` keeps GitHub Pages from filtering the `_astro/` directory.

The design reasoning is in [`design/AURUM.md`](design/AURUM.md).
