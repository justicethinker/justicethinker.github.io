# Full-page stages — plan

Goal: on every page the animation becomes the page surface — a fixed,
full-viewport canvas behind everything — and the content sits on top of it and
talks to it. No empty gap before the footer. Visual identity, copy and the
shared nav/footer stay.

## What exists today

| Page | Script | Technology | Today's housing |
| --- | --- | --- | --- |
| Home | `src/scripts/hero.js` | three.js (CDN import map), WebGL | `.hero` block, `position: absolute` canvas |
| Tech | `src/scripts/orbits.js` | Canvas 2D | `.orbit` block, `min-height: calc(100svh - 4.25rem)` |
| Debate | `src/scripts/scales.js` | Canvas 2D + spring | `.arena--full` block, same min-height |
| Writing | `src/scripts/titles.js` | Canvas 2D particle sampling | `.inkwell--full` block, same min-height |
| Physics | `src/scripts/wave.js` | Canvas 2D, per-cell interference | `.lab` box inside a section |

Shared today: `src/scripts/motion.js` (reveals, drawer, tilt, to-top) loaded
once by `Layout.astro`. Each animation script owns its own `rAF` loop, its own
`resize` listener, its own `IntersectionObserver`, and reads its data from an
inline `<script type="application/json">` block.

Diagnosis of the reported problems:

- Every hero is a *section*, so the page continues below it with ordinary
  sections; the `min-height: 100svh` on three of them is what leaves the black
  gap when the following section is short.
- Tech's dive hijacks `wheel` with `preventDefault`, so it fights the page.
- Debate's balance sign is inverted: `balance()` is positive when the
  proposition side is heavier, and a positive tilt lowers the *right* end, so
  the heavier pan rises. The pan label also reads `INDEX` while the readout
  says "Proposition".
- Writing's particles drift on a sine current even undisturbed, so titles never
  sit still enough to read, and the hero button overlaps the first band.
- Tech labels are drawn unconditionally on every frame with no collision test.
- Home claims "17 more public repos" against a real `techMore.length` of 17 but
  a nav of four sections against three cards.

## Shared layer

### `src/styles/stage.css` (new, imported by `global.css`)

- `.stage` — `position: fixed; inset: 0; z-index: 0; pointer-events: none;`
  holding the canvas. Nothing with `transform`/`filter` may sit above it, or
  `fixed` would resolve against that ancestor instead of the viewport.
- `.stage__canvas` — `width: 100%; height: 100%; touch-action: none` for stages
  that want drags, `touch-action: pan-y` where the page must still scroll.
- `.stage__scrim` — the per-page veil, `pointer-events: none`, kept as a
  gradient so text keeps its contrast over the moving art.
- `.page` — the content layer: `position: relative; z-index: 1;
  pointer-events: none`. Interactive descendants (`.stage-content--auto` list:
  `a`, `button`, `input`, `label`, `.card`, `[data-touch]`) get
  `pointer-events: auto`, so a drag anywhere else lands on the canvas.
- `.hud` — fixed floating panel for relocated controls (`pointer-events: auto`).

### `src/scripts/bus.js` (new)

A ~30-line event channel with `on(name, fn)` / `emit(name, detail)`, plus the
`SCENE` event-name constants. Pages use it for content → scene messages
(`hover`, `focus`, `press`, `weigh`, `section`) and scene → content reports
(`scene:hover`, `scene:pick`).

### `src/scripts/stage.js` (new)

One factory, `createStage({ canvas, onResize, onFrame, ... })`:

- DPR capped at 2 on every page.
- Debounced resize (120 ms) plus `ResizeObserver`, and an initial synchronous
  measure so there is never a frame at the wrong size.
- **One** `rAF` loop for the page; it stops on `document.hidden` and when the
  canvas is off screen, and restores `last` so time never jumps.
- Quality tiers: `low` when the viewport is under 700 px or
  `hardwareConcurrency <= 4`; pages scale their particle counts from it.
- Applies `prefers-reduced-motion`: it paints one composed frame, then reports
  `still` so the page can skip the loop entirely.
- Shared pointer tracking (client coordinates) and page scroll progress,
  emitted on the bus, so scenes do not each add their own listeners.

### Housekeeping

- `motion.js` keeps the drawer, tilt and to-top; reveals gain a
  `[data-reveal]`-safe path so absolutely-positioned overlay content is never
  left invisible.
- Remove `min-height: calc(100svh - 4.25rem)` from the three heroes so page
  height comes from content.

## Per page

1. **Physics** — canvas becomes the full-page tank; the grid resolves from the
   viewport aspect. Each `[data-wave-obstacle]` block (headings, cards, facts)
   is read into a rect list; cells inside a rect are damped so content casts a
   real shadow in the wave field, and hovering a block nudges its phase.
   Controls move into a fixed `.hud`. Dragging emitters works anywhere the
   pointer is not over a control. A new "boundary work" section with a clearly
   marked `[data-placeholder]` body fills the gap the intro promises.
2. **Writing** — titles draw as **crisp canvas text** from an offscreen plate,
   so they are readable at rest; a radial hole punched at the pointer reveals
   the particle cloud, which scatters and re-forms. Bands start below the
   measured content block, so the button can never cover a title. A
   visually-hidden list of real `<a>` links gives keyboard and SEO access, and
   focusing one lights its band.
3. **Debate** — the balance fills the viewport but pivots low, leaving the top
   third clear for copy. Tilt sign fixed so the heavier pan goes down; pan
   labels become `PROPOSITION` / `OPPOSITION`; tags measure their own width and
   wrap instead of clipping. Result cards become draggable chips (pointer drag
   → drop on the half you release over; `←`/`→` on a focused card as the
   keyboard equivalent).
4. **Tech** — the system fills the viewport and the orbits breathe. Dive is
   driven by **scroll progress**, never by `preventDefault` on `wheel`. Labels
   collision-avoid against each other and the intro copy, and only the focused
   or nearest worlds keep a label when crowded. A fixed HUD lists the featured
   repos as real links; hover or focus pulls that planet forward.
5. **Home** — the three.js field becomes the page backdrop. Hovering a card
   attracts the particles inside that card's rect toward it and brightens them
   (per-vertex colour on an additive `Points`). A fourth Physics card joins the
   three, and the repo count is bound to `techMore.length` so it cannot drift.
   Hero spacing opens up.

## Risks

- `position: fixed` silently breaks under a transformed ancestor — the stage
  must stay outside any `perspective` block; the tilt cards live in `.page`,
  which is safe.
- A fixed canvas behind `pointer-events: none` content means text is not
  selectable in the areas that pass through. Interactive and readable blocks
  opt back in; purely decorative padding does not.
- Removing the wheel hijack changes what "dive" means; the interaction check
  must assert scroll-driven zoom instead of a synthetic wheel event.
- Physics is the only page whose cost scales with viewport area. Grid size is
  tiered so a phone still holds 60fps.
