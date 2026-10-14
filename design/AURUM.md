# Aurum

The design system behind this site. Gold on black, three-dimensional, and
built around five sections and nothing else.

It replaced *Paper* — an ink-on-cream document that was deliberately flat, and
whose restraint had started to read as emptiness. This one is the opposite bet:
a dark stage, one metal accent, and depth you can move.

---

## The five sections

Me · Tech · Debate · Writing · Physics.

Nothing else. Every earlier page (work, blog, CV, contact, about, programming)
was folded into one of these five or removed, because a site with nine doors is
a site nobody walks through.

## Field and metal

The field is near-black (`#0a0908`) with the coal surfaces stacked above it
(`#12100d`, `#1a1712`). Gold (`#d4af37`) is the only accent: links, marks, focus
rings, the active nav pill, the primary button. Silver-white (`#ece7db`) carries
the text. Nothing is pure `#000` and nothing is pure `#fff` — a screen is easier
to read when neither extreme is used.

Backgrounds are never flat. Radial gold washes sit behind the page at low
opacity, so the black has depth rather than being a void.

## Depth, three ways

**1. A physics field.** The home hero runs ~700 particles with its own
integrator: spring force back to an anchor, damping, and a radial repulsion from
the pointer. Neighbours within a short radius are joined by faint gold lines, and
a wireframe icosahedron turns at the centre. No physics library — the loop in
`src/scripts/hero.js` *is* the engine (semi-implicit Euler, one substep).

**2. Real 3D tilt.** Cards lean toward the pointer on a perspective transform,
easing back on exit. Pointer-driven, so it is inert on touch rather than being
disabled by a media query.

**3. A simulation you can disturb.** The physics page carries a wave tank: two
or three emitters, drag them anywhere, change the frequency, add or reset a
source. The field is summed per-cell and drawn as gold on black. Double-click
pauses it.

## Rules

**A gesture must answer an input.** Every motion on the site is either the
visitor's pointer, their scroll, or nothing at all. Nothing loops unattended.

**Reduced motion still gets the art.** The hero renders one composed frame and
stops; the tank paints a single frame and repaints only when dragged. The
composition survives without the movement.

**Best-effort decoration, never load-bearing.** three.js arrives from a CDN
through an import map. If it is unreachable, or WebGL is missing, the field
simply does not appear and the hero still reads over its gradient. The wave tank
is hand-rolled and has no such dependency.

**Gold is earned.** One accent for the whole site. If a second colour appears,
something has gone wrong.

**Say only what is true.** Every repo link points at a real repository, every
essay link at a real post, every placing at a real result. No invented metrics,
no borrowed prestige, no "10x".

## The portrait

The home page reserves a framed seat for one photograph, standing on a gold
frame with a slight 3D tilt. Add `public/portrait.jpg` (portrait orientation,
~800×1000 or larger) and the build swaps it in for the JT monogram
automatically — detected at build time, so no request for a missing file ever
leaves the browser.

## What this costs

| | |
|---|---|
| Pages | 6 (five sections + 404) |
| Font files | 2 (one family, two styles), 42 kB |
| Sites of physics code | 2 hand-written, no physics library |
| External requests | 1 (three.js from jsDelivr, home page only) |
| Colours | black, two coals, one gold, silver-white text |

## Verification

- `npm run check` — page audit (console errors, failed requests, overflow at four
  widths, contrast, headings, tap targets) plus 13 interaction checks driving the
  hero frame counter, WebGL context, card tilt, menu, wave tank controls and the
  tank's actual pixels.
- `npm run probe` — screenshots the hero region and counts bright pixels, so a
  canvas that exists but never renders fails instead of passing.

A canvas element with a live WebGL context is not proof of a drawing. That is
why the probe measures the rendered image rather than the DOM.
