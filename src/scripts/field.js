// Two-source interference, the signature motif. A nod to a thesis on
// wireless energy transmission: two coils, one field. Purely decorative —
// it sits behind content, never captures input, pauses off-screen and in
// background tabs, and draws a single still frame for reduced motion.
const canvas = document.querySelector('[data-field]');
if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SCALE = 3; // one computed cell per 3 CSS pixels
  let w = 0, h = 0, img, data, raf = 0, visible = true, last = 0, t = 2.4;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width / SCALE));
    h = Math.max(1, Math.round(r.height / SCALE));
    canvas.width = w; canvas.height = h;
    img = ctx.createImageData(w, h); data = img.data;
    draw();
  };

  const draw = () => {
    if (!data) return;
    const k = 0.5; // wave number per cell
    const s1x = w * 0.18, s1y = h * 0.62, s2x = w * 0.82, s2y = h * 0.38;
    const cx = w / 2, cy = h / 2, rmax = Math.min(w, h) * 0.62;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d1 = Math.hypot(x - s1x, y - s1y);
        const d2 = Math.hypot(x - s2x, y - s2y);
        let v = (Math.cos(k * d1 - t) + Math.cos(k * d2 - t)) * 0.5; // -1..1
        v = v > 0 ? v * v * v * v : 0;
        const dr = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
        const fade = Math.max(0, 1 - dr * dr * 0.9);
        const a = v * fade;
        const i = (y * w + x) * 4;
        data[i] = 178; data[i + 1] = 61; data[i + 2] = 12;
        data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 40) return; // ~25 fps is plenty for a slow field
    t += 0.07 * Math.min(3, (now - last) / 40 || 1);
    last = now;
    draw();
  };
  const start = () => { if (!raf && visible && !still.matches && !document.hidden) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  still.addEventListener?.('change', () => (still.matches ? (stop(), draw()) : start()));
  resize();
  start();
}

// Hairline under the header once the page has moved.
const top = document.querySelector('.top');
if (top) {
  const on = () => top.toggleAttribute('data-scrolled', window.scrollY > 8);
  on();
  addEventListener('scroll', on, { passive: true });
}
