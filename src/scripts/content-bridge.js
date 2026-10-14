/**
 * The content bridge.
 *
 * Any element marked `data-sends="name"` reports its hover, focus and press to
 * the scene behind it over the shared channel. Pages stay declarative — the
 * markup says what talks to the animation, and this file is the only place
 * that knows how.
 */

import bus, { SCENE } from './bus.js';

const detailFor = (el, name) => ({
  name,
  el,
  rect: el.getBoundingClientRect(),
});

export function bridgeContent(root = document) {
  for (const el of root.querySelectorAll('[data-sends]')) {
    if (!(el instanceof HTMLElement)) continue;
    const name = el.getAttribute('data-sends') || el.tagName.toLowerCase();

    el.addEventListener('pointerenter', () => bus.emit(SCENE.hover, detailFor(el, name)));
    el.addEventListener('focusin', () => bus.emit(SCENE.hover, detailFor(el, name)));
    el.addEventListener('pointerleave', () => bus.emit(SCENE.hover, { name: null, rect: null, el }));
    el.addEventListener('focusout', () => bus.emit(SCENE.hover, { name: null, rect: null, el }));
    el.addEventListener('click', () => bus.emit(SCENE.press, detailFor(el, name)));
  }

  // A section entering view is useful to scenes that track reading position.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          bus.emit(SCENE.section, {
            name: entry.target.getAttribute('data-sends') || '',
            rect: entry.target.getBoundingClientRect(),
            el: entry.target,
          });
        }
      },
      { threshold: 0.4 },
    );
    for (const el of root.querySelectorAll('[data-sends]')) observer.observe(el);
  }
}

bridgeContent();
export default bridgeContent;
