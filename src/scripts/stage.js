/**
 * The shared stage.
 *
 * Every page's animation is a fixed, full-viewport canvas behind the content.
 * That means every page needs the same four things — a correctly sized
 * backing store with the DPR capped at 2, one animation frame loop, a paused
 * state when the tab is hidden, and a calm single frame when the visitor has
 * asked for reduced motion. They all live here so no scene grows its own
 * slightly-different copy.
 *
 * A fixed canvas covers the viewport exactly, so a client coordinate is
 * already a canvas coordinate. `stage.pointer` is published in client space
 * for that reason; `stage.toLocal` still subtracts the rect for the cases
 * where the canvas is not (yet) exactly the viewport.
 */

import bus, { SCENE } from './bus.js';

export const DPR_CAP = 2;
const RESIZE_DEBOUNCE = 120;

export function prefersReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 'low' on phones and small machines: scenes cut their particle budgets. */
export function tier() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  return small || cores <= 4 || memory <= 4 ? 'low' : 'high';
}

export function createStage({
  canvas,
  onResize,
  onFrame,
  /** name published on the bus when the scene is alive */
  name = 'scene',
  /** scenes that own their pointer handling set this false */
  trackPointer = true,
}) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  // A canvas that already carries a WebGL context (the home field) cannot
  // hand out a 2D one: `ctx` stays null there and the scene draws through its
  // own renderer. Everything else gets a 2D context immediately.
  const stage = {
    canvas,
    ctx: canvas.getContext('2d'),
    w: 0,
    h: 0,
    dpr: 1,
    tier: tier(),
    still: prefersReduced(),
    pointer: { x: -1e4, y: -1e4, active: false },
    /** page scroll progress, 0 at the top and 1 at the bottom */
    progress: 0,
    /** scroll offset in pixels */
    scrollY: 0,
    running: false,
  };

  /* ------------------------------------------------------------- sizing */

  function measure() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    stage.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const bw = Math.round(w * stage.dpr);
    const bh = Math.round(h * stage.dpr);
    // Writing an unchanged width/height clears the canvas, so only touch it
    // when the size really moved.
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    stage.w = w;
    stage.h = h;
    stage.ctx?.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    onResize?.(stage);
    paintOnce();
  }

  let resizeTimer = 0;
  const scheduleMeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measure, RESIZE_DEBOUNCE);
  };
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('orientationchange', scheduleMeasure, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(canvas);

  /** Map a client point into canvas space. */
  stage.toLocal = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  /* ------------------------------------------------------------- scroll */

  function readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    stage.scrollY = window.scrollY || 0;
    stage.progress = max > 0 ? Math.min(1, Math.max(0, stage.scrollY / max)) : 0;
  }
  readScroll();
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll, { passive: true });

  /* ------------------------------------------------------------ pointer
     One listener for the page. Scenes read stage.pointer each frame; things
     that need an event (dragging, hovering a specific object) subscribe to
     the bus. */

  if (trackPointer) {
    window.addEventListener(
      'pointermove',
      (event) => {
        const p = stage.toLocal(event.clientX, event.clientY);
        stage.pointer.x = p.x;
        stage.pointer.y = p.y;
        stage.pointer.active = true;
        bus.emit('pointer', { ...stage.pointer, event });
      },
      { passive: true },
    );
    window.addEventListener('pointerleave', () => {
      stage.pointer.active = false;
      bus.emit('pointer', { ...stage.pointer, event: null });
    });
    window.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      const p = stage.toLocal(touch.clientX, touch.clientY);
      stage.pointer.x = p.x;
      stage.pointer.y = p.y;
      stage.pointer.active = true;
    }, { passive: true });
  }

  /* --------------------------------------------------------------- loop */

  function paintOnce() {
    onFrame?.(0, 0, stage);
  }

  let last = 0;
  let raf = 0;
  let visible = true;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    ).observe(canvas);
  }

  canvas.dataset[`${name}Tier`] = stage.tier;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    onFrame?.(dt, now / 1000, stage);
  }

  stage.start = () => {
    if (stage.running) return;
    stage.running = true;
    last = 0;
    raf = requestAnimationFrame(loop);
  };
  stage.stop = () => {
    stage.running = false;
    cancelAnimationFrame(raf);
  };
  /** Redraw immediately, for the reduced-motion path and on demand. */
  stage.paint = () => paintOnce();

  // Measure synchronously first, so there is never a frame at the wrong size.
  measure();

  if (stage.still) {
    canvas.dataset[`${name}State`] = 'still';
  } else {
    canvas.dataset[`${name}State`] = 'live';
    stage.start();
  }

  bus.emit(SCENE.ready, { name, stage });
  return stage;
}
