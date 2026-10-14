# Universes

One interactive universe per page. Approved by the owner after the three-way
choice (solar system / tug-of-war / gold ink). The Me field and the Physics
tank are untouched.

## Tech — a solar system (`src/scripts/orbits.js`)

Six featured repos are planets orbiting a gold sun. Each planet has its own
orbital radius, angular speed, size and tint. Orbits are tilted ellipses:
planets pass behind and in front of the sun with depth scaling (size and
brightness), which reads as 3D on a plain 2D canvas.

- Hover or tap a planet: a detail panel shows that repo's name, language,
  body and GitHub link. Escape or tapping empty space closes it.
- Dragging empty space adds spin to the whole system; it decays back to the
  base rate, like the hero field settles.
- `data-orbit-stage` on the wrapper, `data-orbit-panel` for the panel,
  `data-orbit-name` / `data-orbit-meta` / `data-orbit-body` /
  `data-orbit-link` inside it. The script writes `data-system="live"` and a
  climbing `data-frames` once the loop runs, so the checks can observe it.
- Reduced motion: one composed frame with every planet labelled, no loop.
- No canvas, no WebGL, no dependency. The repo cards below stay as the
  readable record.

## Debate — a tug-of-war field (`src/scripts/tug.js`)

Two poles, Proposition (gold) vs Opposition (silver), pull ~400 particles.
Each particle feels both attractions plus damping; the pointer joins whichever
side it stands nearer to, and two buttons ("Argue for" / "Argue against") fire
a pulse from that side for keyboard and touch users. A live balance meter
(`data-tug-meter`, `role="status"`) shows the current split; it decays to
50/50 at rest.

- Reduced motion: a single static frame at 50/50; the buttons still move the
  meter once each (state change, not motion).
- Results, talks and rules cards below are unchanged.

## Writing — gold ink in water (`src/scripts/ink.js`)

Drag to pour liquid-gold ink into dark water. Ink particles spawn at the
pointer, advect through a curl-style flow field, and fade; additive blending
on near-black does the glowing. Essay list below is unchanged.

- `data-ink-stage` wrapper; the script writes `data-ink="live"` after the
  first frame. The check samples canvas pixels for real ink.
- Reduced motion: one pre-composed bloom, repaints on drag end only.

## Shared engineering rules

- Zero new dependencies. Three.js stays home-only.
- Every canvas: resizes with its box, pauses when offscreen
  (IntersectionObserver), caps device pixel ratio at 2, shrinks particle
  counts under 700px widths, never throws when its elements are absent.
- Every page reads fully with scripting off; canvases are `aria-hidden` where
  decorative and labelled controls where interactive.
- New checks in `tools/check-interactions.mjs`, one per universe, asserting
  observable behaviour (panel opens with the right repo, meter moves, ink
  pixels exist) — never DOM presence alone.
- Screenshots of all three pages at 1440 and 390 before committing.

## Self-review

- No placeholders: all copy comes from `src/data/site.ts`, which already
  exists. No new content model needed.
- No contradictions: reduced-motion behaviour is specified per universe and
  matches the existing hero/tank precedent (one composed frame, then stop).
- Scope: three scripts, three page sections, one checks file, one CSS
  addition. Fits one implementation pass.
- Ambiguity resolved: "live" markers use distinct dataset keys per universe
  so the checks cannot confuse one canvas for another.
