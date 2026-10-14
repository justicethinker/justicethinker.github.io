/**
 * Gold ink in water — the writing page pours.
 *
 * Drag to release liquid-gold ink into dark water. Ink particles spawn at the
 * pointer, advect through a slow curling flow field, and fade; additive
 * blending on near-black does the glowing. Ambient drops fall on their own
 * until the visitor takes over. Plain Canvas 2D, no library.
 */

const stage = document.querySelector('[data-ink-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('[data-ink-canvas]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = window.innerWidth < 700 ? 500 : 1100;

  // SoA ink particles: position in unit space, age, seed.
  const ix = new Float32Array(MAX);
  const iy = new Float32Array(MAX);
  const age = new Float32Array(MAX).fill(1e9);
  const seed = new Float32Array(MAX);
  const hue = new Float32Array(MAX);
  let head = 0;
  let alive = 0;

  let W = 0;
  let H = 0;
  let time = Math.random() * 100;
  let pouring = false;
  let lastPour = { x: 0.5, y: 0.4 };
  let touched = false;
  let visible = true;

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 280);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A dark wash so resizes never flash the page background through.
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, W, H);
  }

  function pour(x, y, n, spread) {
    for (let k = 0; k < n; k++) {
      const i = head;
      head = (head + 1) % MAX;
      ix[i] = x + (Math.random() - 0.5) * spread;
      iy[i] = y + (Math.random() - 0.5) * spread * 0.6;
      age[i] = 0;
      seed[i] = Math.random() * 1000;
      hue[i] = Math.random();
      if (alive < MAX) alive++;
    }
  }

  // A slow curling current from layered sines — cheap, smooth, endless.
  function flow(x, y, t, out) {
    const s1 = Math.sin(y * 5.1 + t * 0.5 + Math.sin(x * 3.3 - t * 0.3));
    const s2 = Math.sin(x * 4.3 - t * 0.4 + Math.sin(y * 2.7 + t * 0.35));
    out.x = s1 * 0.16 - (y - 0.5) * 0.05;
    out.y = s2 * 0.12 + 0.028; // a faint downward drift, like settling ink
  }

  const vel = { x: 0, y: 0 };

  function step(dt) {
    time += dt;
    for (let n = 0; n < MAX; n++) {
      if (age[n] > 6) continue;
      age[n] += dt;
      flow(ix[n], iy[n], time + seed[n] * 0.01, vel);
      ix[n] += vel.x * dt;
      iy[n] += vel.y * dt;
      if (ix[n] < -0.05) ix[n] = 1.05;
      if (ix[n] > 1.05) ix[n] = -0.05;
      if (iy[n] > 1.05) {
        age[n] = 1e9; // settled out at the bottom
        continue;
      }
    }
  }

  function paint() {
    // Fade the frame instead of clearing it: trails bloom and linger.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = reduce ? '#0a0908' : 'rgba(10,9,8,0.16)';
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < MAX; n++) {
      const a = age[n];
      if (a > 6) continue;
      const life = a < 0.6 ? a / 0.6 : 1 - (a - 0.6) / 5.4; // in, then long out
      if (life <= 0) continue;
      const r = (1.1 + a * 1.6) * Math.min(W, H) * 0.004;
      const h = hue[n];
      // Gold with depth: bright core, amber edge.
      ctx.fillStyle =
        h < 0.35
          ? `rgba(246,229,141,${(0.5 * life).toFixed(3)})`
          : `rgba(212,175,55,${(0.42 * life).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ix[n] * W, iy[n] * H, Math.max(r, 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    canvas.dataset.ink = 'live';
  }

  /* ---------------------------------------------------------- interaction */

  const toUnit = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  canvas.addEventListener('pointerdown', (event) => {
    pouring = true;
    touched = true;
    const p = toUnit(event);
    lastPour = p;
    pour(p.x, p.y, 26, 0.02);
    canvas.setPointerCapture(event.pointerId);
    if (reduce) {
      for (let s = 0; s < 30; s++) step(1 / 30);
      paint();
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pouring) return;
    const p = toUnit(event);
    const dist = Math.hypot(p.x - lastPour.x, p.y - lastPour.y);
    const n = Math.min(30, 4 + Math.round(dist * 900));
    pour(p.x, p.y, n, 0.014);
    lastPour = p;
    if (reduce) {
      for (let s = 0; s < 12; s++) step(1 / 30);
      paint();
    }
  });

  const stop = () => {
    pouring = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  /* --------------------------------------------------------------- frame */

  fit();
  // The opening bloom, composed before anyone touches it.
  pour(0.5, 0.42, Math.round(MAX * 0.35), 0.1);
  for (let s = 0; s < 50; s++) step(1 / 30);
  paint();
  window.addEventListener('resize', fit, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  if (reduce) return;

  let last = performance.now();
  let frames = 0;
  let ambientAt = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    // Until the visitor takes over, the page pours for itself — slowly.
    if (!touched && now - ambientAt > 2600) {
      ambientAt = now;
      pour(0.25 + Math.random() * 0.5, 0.3 + Math.random() * 0.2, 60, 0.03);
    }
    step(dt);
    paint();
    canvas.dataset.frames = String(++frames);
  };
  requestAnimationFrame(loop);
}
