# Paper

The design system behind justicethinker.github.io.

It replaced a dark spectrograph — neon emission lines, instrument labels, a
canvas in the hero — with something much harder to get right: almost nothing.

---

## The problem with the first version

It looked like an instrument because every element was labelled like one. Numbered
sections, wavelength captions, registration ticks on every image, statistics in
grids, a fixed rail of tick marks, monospace for anything that was a datum. Each
piece was defensible on its own. Together they were noise, and the reader had to
walk through the furniture to find the writing.

Simple is not the absence of effort. It is the absence of things that do not
carry the argument.

## The rules

**Paper, not screen.** The field is a warm off-white (`#f7f5f1`), the text a warm
near-black (`#1b1815`). Nothing is pure white and nothing is pure black; a
document reads better when it looks like it is going to be printed.

**One accent, spent rarely.** A muted vermilion (`#a4472c`) for links, the current
page, and focus rings. It is not used for decoration anywhere, which is what makes
it mean something when it appears.

**Two voices.** A high-contrast serif for display — Instrument Serif, the only
font shipped. Text is the platform's own interface sans, which is excellent
everywhere, costs nothing, cannot flash, and never fails to load. The monospace
layer is gone entirely: it was a costume.

**Hairlines, not boxes.** Structure is drawn with 1px rules at 13% ink. There are
no cards, no shadows, no filled panels. Lists are lists.

**A ruled row holds only what exists.** One thing in the row when there is one
thing; a label beside a line only when both are present. An empty label column is
an indent pretending to be structure, and a label that reaches into the line
beside it is the same mistake from the other side — so the label column is sized
to the longest label in the content model, and a label that still cannot fit
breaks instead of colliding.

**One gesture.** Content settles ten pixels into place as it arrives, once. No
parallax, no marquee, no looping decoration, no counter animations. Nothing on
this site moves on its own, at any time.

**Numbers as facts, not trophies.** Statistics appear in a plain list of rows,
next to the words they describe, instead of as large numerals in a grid.

**Four links, not nine.** The masthead carries Work, Writing, About and Contact.
Everything else waits in the menu or the footer. Navigation that needs a map is
not navigation.

## The one image

Every image is generated. The single drawing used on the site is the interference
field — a few emitters summed into one scalar value — rendered as ink contours on
paper: fine lines where the field is steep, open curves where it is flat.

It appears twice, always as a still: a full-bleed plate on the home page, and
beside the modelling notes on the physics page. It was first made as an
eight-second loop, and that was thrown away. Encoded line art cost between two
and nine megabytes for a drift a visitor watches for two seconds; the still
carries the same idea for a tenth of the weight, and so the site ships no video
and no autoplaying media at all.

## What this costs

Restraint is measurable, and worth measuring:

| | |
|---|---|
| Font files | 2 (one family, two styles), 42 kB |
| Client JavaScript | 3.3 kB, 1.4 kB gzipped |
| Third-party requests | 0 |
| Colours on the page | paper, four grays, one accent |
| Elements in the masthead | brand + 4 links |

If a future change adds a box, a colour, or a label without being able to say what
argument it carries, it is a regression.
