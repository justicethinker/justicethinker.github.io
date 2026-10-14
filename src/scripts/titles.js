/**
 * Living titles — the essays are the visual.
 *
 * Each essay title is sampled into a field of gold particles that drift,
 * scatter from the pointer, and spring back to reform the words. Click a
 * title to open it. The essay list below stays as the readable record.
 *
 * Plain Canvas 2D, no library. Squares, not arcs: thousands of them.
 */

const stage = document.querySelector('[data-titles-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('[data-titles-canvas]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let essays = [];
  try {
    essays = JSON.parse(stage.querySelector('[data-titles-data]')?.textContent || '[]');
  } catch {
    essays = [];
  }
  if (!Array.isArray(essays) || essays.length === 0) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FAMILIES = 3; // bands on screen; extra essays share the last band
  let fields = []; // {essay, hx,hy,vx,vy arrays, box}
  let W = 0;
  let H = 0;
  let pointer = null;
  let hovered = -1;
  let visible = true;
  let built = false;

  // Long titles wrap to two lines instead of truncating: an ellipsis on a
  // hero reads as a broken promise. Split near the middle on a word boundary.
  function linesFor(title) {
    if (title.length <= 30) return [title];
    const words = title.split(' ');
    let best = 1;
    let bestScore = 1e9;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const score = Math.abs(a - b) + Math.abs(a - title.length / 2) * 0.2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 320);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    paint();
  }

  function bandLines() {
    // Flattened lines across essays; each remembers its essay for clicks.
    const out = [];
    for (const e of essays.slice(0, FAMILIES)) {
      for (const line of linesFor(e.title)) out.push({ line, essay: e });
    }
    return out;
  }

  function build() {
    fields = [];
    const lines = bandLines();
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return;

    lines.forEach(({ line, essay }, li) => {
      // Fit the line across the stage.
      let px = Math.min(64, Math.max(26, W / 16));
      const setFont = (s) => {
        octx.font = `400 ${s}px "Instrument Serif", Georgia, serif`;
      };
      setFont(px);
      while (octx.measureText(line).width > W * 0.86 && px > 18) {
        px -= 2;
        setFont(px);
      }

      off.width = Math.ceil(W);
      off.height = Math.ceil(px * 1.6);
      setFont(px);
      octx.textBaseline = 'middle';
      octx.fillStyle = '#fff';
      octx.fillText(line, (off.width - octx.measureText(line).width) / 2, off.height / 2);

      const img = octx.getImageData(0, 0, off.width, off.height).data;
      // Sample step adapts to hold each field near ~1400 particles.
      const target = 1400;
      const coverage = 0.16;
      const step = Math.max(2, Math.round(Math.sqrt((off.width * off.height * coverage) / target)));

      const hx = [];
      const hy = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (img[(y * off.width + x) * 4] > 128) {
            hx.push(x + (Math.random() - 0.5) * 1.5);
            hy.push(y + (Math.random() - 0.5) * 1.5);
          }
        }
      }

      const n = hx.length;
      const bandTop = H * (lines.length === 1 ? 0.6 : 0.42 + (li / (lines.length - 1)) * 0.44);
      for (let k = 0; k < hy.length; k++) hy[k] += bandTop;
      fields.push({
        essay,
        title: line,
        hx: Float32Array.from(hx),
        hy: Float32Array.from(hy),
        vx: new Float32Array(n),
        vy: new Float32Array(n),
        seed: Float32Array.from({ length: n }, () => Math.random() * 1000),
        box: null,
      });
    });

    computeBoxes();
    built = true;
  }

  function computeBoxes() {
    for (const f of fields) {
      if (f.hx.length === 0) {
        f.box = null;
        continue;
      }
      let x0 = 1e9;
      let x1 = -1e9;
      let y0 = 1e9;
      let y1 = -1e9;
      for (let i = 0; i < f.hx.length; i++) {
        if (f.hx[i] < x0) x0 = f.hx[i];
        if (f.hx[i] > x1) x1 = f.hx[i];
        if (f.hy[i] < y0) y0 = f.hy[i];
        if (f.hy[i] > y1) y1 = f.hy[i];
      }
      f.box = { x0: x0 - 24, x1: x1 + 24, y0: y0 - 26, y1: y1 + 26 };
    }
  }

  // Live positions start at home; keep a parallel copy for motion.
  let live = [];
  function syncLive() {
    live = fields.map((f) => ({ x: Float32Array.from(f.hx), y: Float32Array.from(f.hy) }));
  }

  function paint() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e9c860';
    const s = W < 700 ? 2 : 2.4;
    fields.forEach((f, fi) => {
      const L = live[fi];
      if (!L) return;
      ctx.globalAlpha = fi === hovered ? 0.95 : 0.75;
      ctx.beginPath();
      for (let i = 0; i < f.hx.length; i++) {
        ctx.rect(L.x[i], L.y[i], s, s);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Underline the hovered title: an invitation, not a button chrome.
    if (hovered >= 0 && fields[hovered]?.box) {
      const b = fields[hovered].box;
      ctx.strokeStyle = 'rgba(240,216,120,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x0 + 10, b.y1 - 8);
      ctx.lineTo(b.x1 - 10, b.y1 - 8);
      ctx.stroke();
    }

    canvas.dataset.titles = 'live';
  }

  function step(dt, t) {
    fields.forEach((f, fi) => {
      const L = live[fi];
      for (let i = 0; i < f.hx.length; i++) {
        // Drift on a slow current + spring home.
        const dx = Math.sin(t * 0.5 + f.seed[i]) * 3;
        const dy = Math.cos(t * 0.4 + f.seed[i] * 1.3) * 3;
        let ax = (f.hx[i] + dx - L.x[i]) * 2.2;
        let ay = (f.hy[i] + dy - L.y[i]) * 2.2;

        if (pointer) {
          const ddx = L.x[i] - pointer.x;
          const ddy = L.y[i] - pointer.y;
          const d2 = ddx * ddx + ddy * ddy;
          const R2 = 110 * 110;
          if (d2 < R2 && d2 > 1) {
            const d = Math.sqrt(d2);
            const push = ((110 - d) / 110) * 900;
            ax += (ddx / d) * push;
            ay += (ddy / d) * push;
          }
        }

        L.vx ??= new Float32Array(f.hx.length);
        L.vy ??= new Float32Array(f.hx.length);
        L.vx[i] = (L.vx[i] + ax * dt) * 0.92;
        L.vy[i] = (L.vy[i] + ay * dt) * 0.92;
        L.x[i] += L.vx[i] * dt * 4;
        L.y[i] += L.vy[i] * dt * 4;
      }
    });
  }

  /* ---------------------------------------------------------- interaction */

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function bandAt(pt) {
    for (let b = 0; b < fields.length; b++) {
      const box = fields[b].box;
      if (box && pt.x >= box.x0 && pt.x <= box.x1 && pt.y >= box.y0 && pt.y <= box.y1) return b;
    }
    return -1;
  }

  canvas.addEventListener('pointermove', (event) => {
    pointer = toLocal(event);
    const hit = bandAt(pointer);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit >= 0 ? 'pointer' : '';
      if (reduce) paint();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    hovered = -1;
    if (reduce) paint();
  });
  canvas.addEventListener('click', (event) => {
    const hit = bandAt(toLocal(event));
    if (hit >= 0 && fields[hit].essay?.url) {
      window.open(fields[hit].essay.url, '_blank', 'noopener');
    }
  });

  /* --------------------------------------------------------------- frame */

  // The display face must be ready before sampling, or the particles form
  // fallback letterforms. Build now for paint, rebuild when fonts land.
  fit();
  syncLive();
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      fit();
      syncLive();
      paint();
    });
  }
  window.addEventListener('resize', () => {
    fit();
    syncLive();
  }, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  if (reduce) {
    paint();
    return;
  }

  let last = performance.now();
  let frames = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden || !built) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    step(dt, now / 1000);
    paint();
    canvas.dataset.frames = String(++frames);
  };
  requestAnimationFrame(loop);
}
