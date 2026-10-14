/**
 * The wave lab — a real interference simulation you can touch.
 *
 * Two or three emitters radiate circular waves across a tank; where they
 * meet, they add. Drag an emitter to move it, change the frequency, add or
 * remove a source. Computed per-pixel on a small offscreen grid and blitted  * up, in its own warm hue on black. No library.
  * Effect-local palette: independent of the site's silver/white theme.
 */

const stage = document.querySelector('[data-wave-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('canvas');
  const freq = stage.querySelector('[data-wave-freq]');
  const addBtn = stage.querySelector('[data-wave-add]');
  const resetBtn = stage.querySelector('[data-wave-reset]');
  const readout = stage.querySelector('[data-wave-readout]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Simulation grid — coarse, then scaled up. Fast on phones.
  const GW = 220;
  const GH = 120;
  const field = new Float32Array(GW * GH);
  const off = document.createElement('canvas');
  off.width = GW;
  off.height = GH;
  const offCtx = off.getContext('2d');
  const img = offCtx.createImageData(GW, GH);

  const sources = [
    { x: 0.32, y: 0.5, phase: 0 },
    { x: 0.68, y: 0.5, phase: 0 },
  ];

  let wavelength = Number(freq?.value || 14); // grid px per cycle
  let time = 0;
  let running = !reduce;
  let dragIndex = -1;
  let visible = true;

  const srcPos = (s) => ({ x: s.x * GW, y: s.y * GH });

  function paint(t) {
    const k = (Math.PI * 2) / wavelength;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        let sum = 0;
        for (let s = 0; s < sources.length; s++) {
          const p = srcPos(sources[s]);
          const dx = gx - p.x;
          const dy = (gy - p.y) * 1.4;
          const d = Math.sqrt(dx * dx + dy * dy);
          const decay = 1 / (1 + d * 0.045);
          sum += Math.sin(d * k - t * 3 + sources[s].phase) * decay;
        }
        field[gy * GW + gx] = sum / sources.length;
      }
    }

    const data = img.data;
    for (let i = 0; i < field.length; i++) {
      const v = field[i]; // -1..1
      const glow = Math.abs(v);
      const o = i * 4;
      data[o] = 12 + glow * 228; // r
      data[o + 1] = 10 + glow * 188; // g
      data[o + 2] = 8 + glow * 90; // b
      data[o + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);

    const w = canvas.width;
    const h = canvas.height;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0, w, h);

    // Emitters on top.
    for (let s = 0; s < sources.length; s++) {
      const x = sources[s].x * w;
      const y = sources[s].y * h;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f0d878'; // effect-local emitter ring
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f0d878'; // effect-local emitter dot
      ctx.fill();
    }
  }

  function fit() {
    const rect = stage.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(((rect.width * 9) / 16) * ratio);
    canvas.style.aspectRatio = '16 / 9';
    paint(time);
  }

  function note() {
    if (readout) {
      readout.textContent =
        sources.length === 1
          ? 'One source: clean rings, nothing to argue with.'
          : `${sources.length} sources: drag one and watch the pattern renegotiate.`;
    }
    if (addBtn) addBtn.disabled = sources.length >= 3;
  }

  /* ---------------------------------------------------------- interaction */

  const eventPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const nearSource = (p) => {
    let best = -1;
    let bestD = 0.06;
    sources.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  canvas.addEventListener('pointerdown', (event) => {
    const i = nearSource(eventPoint(event));
    if (i >= 0) {
      dragIndex = i;
      canvas.setPointerCapture(event.pointerId);
      running = true;
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (dragIndex < 0) return;
    const p = eventPoint(event);
    sources[dragIndex].x = Math.min(0.98, Math.max(0.02, p.x));
    sources[dragIndex].y = Math.min(0.96, Math.max(0.04, p.y));
    if (reduce) paint(time);
  });

  const endDrag = () => {
    dragIndex = -1;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  freq?.addEventListener('input', () => {
    wavelength = Number(freq.value);
    if (reduce) paint(time);
  });

  addBtn?.addEventListener('click', () => {
    if (sources.length >= 3) return;
    sources.push({ x: 0.5, y: 0.3, phase: Math.PI / 2 });
    running = true;
    note();
    if (reduce) paint(time);
  });

  resetBtn?.addEventListener('click', () => {
    sources.length = 0;
    sources.push({ x: 0.32, y: 0.5, phase: 0 }, { x: 0.68, y: 0.5, phase: 0 });
    running = true;
    note();
    if (reduce) paint(time);
  });

  // Tap the tank to pause; tap again to resume.
  canvas.addEventListener('dblclick', () => {
    running = !running;
  });

  /* --------------------------------------------------------------- frame */

  fit();
  note();
  window.addEventListener('resize', fit, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  if (reduce) {
    paint(2.2); // one composed frame; drags repaint on demand
    return;
  }

  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || !running) return;
    time += Math.min((now - last) / 1000, 1 / 20);
    last = now;
    paint(time);
  };
  requestAnimationFrame(loop);
}
