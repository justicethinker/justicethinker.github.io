/**
 * The site's event channel.
 *
 * Pages have two halves that must talk to each other: the DOM content layer
 * and the full-page animation behind it. Neither should import the other, so
 * they meet here — the content emits what the visitor did, the scene reports
 * what the visitor is over. Names are collected in SCENE so a typo is a
 * missing key rather than a silent no-op.
 */

const listeners = new Map();

export const SCENE = {
  /** content → scene: the pointer or focus entered a named thing */
  hover: 'hover',
  /** content → scene: focus left every named thing */
  blur: 'blur',
  /** content → scene: a thing was activated */
  press: 'press',
  /** content → scene: weigh this on a pan ('for' | 'against') */
  weigh: 'weigh',
  /** content → scene: a page section moved into view */
  section: 'section',
  /** scene → content: the scene picked something under the cursor */
  picked: 'scene:picked',
  /** scene → content: the scene is ready for traffic */
  ready: 'scene:ready',
};

/** Subscribe. Returns an unsubscribe function. */
export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

/** Publish. A throwing listener must not take the frame down with it. */
export function emit(name, detail) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(detail);
    } catch (error) {
      console.warn(`[bus] listener for "${name}" failed`, error);
    }
  }
}

export const bus = { on, emit, SCENE };
export default bus;
