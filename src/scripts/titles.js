/**
 * Living titles — now the whole page.
 *
 * The essay titles are the scene, but legibility wins: each title is drawn as
 * crisp canvas text from its own plate, so it reads perfectly at rest. Where
 * the pointer is, a hole is punched in the plate and the sampled particles
 * behind it scatter outward and spring back into the letterforms — the words
 * dissolve under your hand and re-form.
 *
 * The title layer fades as the page scrolls past the intro, so the essay list
 * is never read through a title. Clicking a title opens the essay; the real
 * links live in the DOM shelf for keyboard, screen readers and crawlers.
 *
 * Effect-local palette: independent of the site's theme.
 */

import { createStage } from './stage.js';
import bus, { SCENE } from './bus.js';

const EFFECT = {
  ink: '#e9c860',
  underline: 'rgba(240,216,120,0.75)',
  dust: '#f2dd94',
};

const stageEl = document.querySelector('[data-titles-stage]');
if (stageEl instanceof HTMLElement) boot(stageEl);

function boot(stageEl) {
  const canvas = stageEl.querySelector('[data-titles-canvas]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  let essays = [];
  try {
    essays = JSON.parse(stageEl.querySelector('[data-titles-data]')?.textContent || '[]');
  } catch {
    essays = [];
  }
  if (!Array.isArray(essays) || essays.length === 0) return;

  const content = document.querySelector('[data-titles-content]');
  const shelf = document.querySelector('[data-title-links]');

  let stage = null;
  let fields = []; // one per drawn line
  let W = 0;
  let H = 0;
  let pointer = null;
  let focused = -1;
  let hovered = -1;
  let built = false;
  let layer = 1; // 1 near the top of the page, 0 once the essays scroll up
  let reserved = 0; // px of the flow set aside for the title bands

  // A scratch plate we reuse every frame: the title, minus a hole where the
  // pointer is.
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  /** Long titles wrap near the middle on a word boundary instead of clipping. */
  function linesFor(title) {
    if (title.length <= 32) return [title];
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

  function build(s) {
    fields = [];
    if (!sctx) return;

    const lines = [];
    essays.forEach((essay, index) => {
      for (const line of linesFor(essay.title)) lines.push({ line, essay, index });
    });

    // Titles begin below the measured intro block, so no control can ever sit
    // on top of a title. The room the bands need is reserved in the content
    // flow below, which is what keeps the essay list from landing on them.
    const introBottom = content ? content.getBoundingClientRect().bottom : 0;
    const top = Math.max(H * 0.34, introBottom + 26);
    const bottomPad = H < 700 ? 56 : 84;
    const region = Math.max(140, H - top - bottomPad);
    const lineH = region / lines.length;

    reserved = Math.max(0, Math.round(top + region - introBottom));
    document.documentElement.style.setProperty('--title-stage', `${reserved}px`);

    let px = Math.max(19, Math.min(56, Math.min(W / 13, lineH * 0.74)));
    scratch.width = Math.max(2, Math.ceil(W));
    scratch.height = Math.max(2, Math.ceil(px * 1.5));
    const plateH = scratch.height;

    const sample = document.createElement('canvas');
    const sx = sample.getContext('2d', { willReadFrequently: true });
    if (!sx) return;

    lines.forEach(({ line, essay, index }, i) => {
      // Fit the line across the stage.
      let size = px;
      const setFont = (target, value) => {
        target.font = `400 ${value}px "Instrument Serif", Georgia, serif`;
      };
      setFont(sx, size);
      while (sx.measureText(line).width > W * 0.84 && size > 15) {
        size -= 1;
        setFont(sx, size);
      }

      const ph = Math.ceil(size * 1.5);
      sample.width = scratch.width;
      sample.height = ph;
      setFont(sx, size);
      sx.textBaseline = 'middle';
      sx.fillStyle = '#fff';
      sx.fillText(line, (sample.width - sx.measureText(line).width) / 2, ph / 2);

      const pixels = sx.getImageData(0, 0, sample.width, ph).data;

      // Density: enough particles that a scatter reads as the word breaking up.
      const target = s.tier === 'low' ? 520 : 900;
      const step = Math.max(2, Math.round(Math.sqrt((sample.width * ph * 0.18) / target)));

      const hx = [];
      const hy = [];
      for (let y = 0; y < ph; y += step) {
        for (let x = 0; x < sample.width; x += step) {
          if (pixels[(y * sample.width + x) * 4] > 128) {
            hx.push(x + (Math.random() - 0.5) * 1.2);
            hy.push(y + (Math.random() - 0.5) * 1.2);
          }
        }
      }

      const y = top + i * lineH + (lineH - ph) / 2;
      const plate = document.createElement('canvas');
      plate.width = sample.width;
      plate.height = ph;
      const pctx = plate.getContext('2d');
      if (!pctx) return;
      setFont(pctx, size);
      pctx.textBaseline = 'middle';
      pctx.fillStyle = EFFECT.ink;
      pctx.fillText(line, (plate.width - pctx.measureText(line).width) / 2, ph / 2);

      fields.push({
        essay,
        index,
        text: line,
        plate,
        x: 0,
        y,
        h: ph,
        hx: Float32Array.from(hx),
        hy: Float32Array.from(hy),
        vx: new Float32Array(hx.length),
        vy: new Float32Array(hy.length),
        box: null,
      });
    });

    for (const f of fields) {
      if (f.hx.length === 0) continue;
      let x0 = 1e9;
      let x1 = -1e9;
      for (let i = 0; i < f.hx.length; i++) {
        if (f.hx[i] < x0) x0 = f.hx[i];
        if (f.hx[i] > x1) x1 = f.hx[i];
      }
      f.box = { x0: x0 - 18, x1: x1 + 18, y0: f.y - 14, y1: f.y + f.h + 14 };
    }

    built = true;
  }

  /* ---------------------------------------------------------------- paint */

  function paint(s) {
    if (!sctx) return;
    const ctx = s.ctx;
    ctx.clearRect(0, 0, W, H);
    if (!built) return;

    ctx.globalAlpha = layer;

    const scatterR = s.tier === 'low' ? 92 : SCATTER_R;

    for (const f of fields) {
      const active = f.index === hovered || f.index === focused;
      const alpha = active ? 1 : 0.82;

      // 1. The crisp title, with a hole punched where the pointer is.
      scratch.width = f.plate.width;
      scratch.height = f.plate.height;
      sctx.globalCompositeOperation = 'source-over';
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      sctx.drawImage(f.plate, 0, 0);

      if (pointer) {
        const lx = pointer.x - f.x;
        const ly = pointer.y - f.y;
        if (lx > -scatterR && lx < scratch.width + scatterR && ly > -scatterR && ly < scratch.height + scatterR) {
          const hole = sctx.createRadialGradient(lx, ly, 0, lx, ly, scatterR * 0.85);
          hole.addColorStop(0, 'rgba(0,0,0,1)');
          hole.addColorStop(0.55, 'rgba(0,0,0,0.85)');
          hole.addColorStop(1, 'rgba(0,0,0,0)');
          sctx.globalCompositeOperation = 'destination-out';
          sctx.fillStyle = hole;
          sctx.fillRect(lx - scatterR, ly - scatterR, scatterR * 2, scatterR * 2);
          sctx.globalCompositeOperation = 'source-over';
        }
      }

      ctx.globalAlpha = layer * alpha;
      ctx.drawImage(scratch, f.x, f.y);

      // 2. The dust that has been knocked off the letters. Displacement is
      //    stored in vx/vy, so a settled particle (offset ~0) is not drawn at
      //    all — the plate is what you read.
      ctx.fillStyle = EFFECT.dust;
      ctx.beginPath();
      let drawn = 0;
      for (let i = 0; i < f.hx.length; i++) {
        const ox = f.vx[i];
        const oy = f.vy[i];
        const lx = f.x + f.hx[i] + ox;
        const ly = f.y + f.hy[i] + oy;
        const settled = Math.abs(ox) + Math.abs(oy) < 0.4;
        const near = pointer ? Math.hypot(lx - pointer.x, ly - pointer.y) < scatterR : false;
        if (settled && !near) continue;
        ctx.rect(lx, ly, 2, 2);
        drawn++;
        if (drawn > 4000) break;
      }
      if (drawn) ctx.fill();

      // Underline the title whose link has focus or the pointer.
      if (active && f.box) {
        ctx.globalAlpha = layer * 0.9;
        ctx.strokeStyle = EFFECT.underline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.box.x0 + 12, f.box.y1 - 4);
        ctx.lineTo(f.box.x1 - 12, f.box.y1 - 4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    canvas.dataset.titles = 'live';
    // Where each title sits, so the scene's geometry is inspectable rather
    // than guessed at from outside.
    canvas.dataset.bands = JSON.stringify(
      fields.map((f) => ({ x: Math.round(f.x + f.plate.width / 2), y: Math.round(f.y + f.h / 2) })),
    );
    canvas.dataset.pointer = pointer ? `${Math.round(pointer.x)},${Math.round(pointer.y)}` : '';
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }

  /* -------------------------------------------------------------- physics */

  // vx/vy hold the displacement from the letterform. A spring pulls each
  // particle home, damping settles it, and the pointer shoves it outward.
  // PUSH / SPRING_K is how far a particle ends up from its letterform at the
  // very centre of the cursor: enough that the letters break into dust there
  // and the punched plate shows through, rather than the dust simply settling
  // back over the hole it came from.
  const SPRING_K = 34;
  const DAMPING = 0.86;
  const SCATTER_R = 118;
  const PUSH = 2600;
  const MAX_OFFSET = SCATTER_R * 2.4;

  function step(dt) {
    const damp = Math.pow(DAMPING, dt * 60);
    for (const f of fields) {
      for (let i = 0; i < f.hx.length; i++) {
        let ax = -SPRING_K * f.vx[i];
        let ay = -SPRING_K * f.vy[i];

        if (pointer) {
          const wx = f.x + f.hx[i] + f.vx[i];
          const wy = f.y + f.hy[i] + f.vy[i];
          const ddx = wx - pointer.x;
          const ddy = wy - pointer.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < SCATTER_R * SCATTER_R && d2 > 1) {
            const d = Math.sqrt(d2);
            const force = ((SCATTER_R - d) / SCATTER_R) * PUSH;
            ax += (ddx / d) * force;
            ay += (ddy / d) * force;
          }
        }

        let vx = (f.vx[i] + ax * dt) * damp;
        let vy = (f.vy[i] + ay * dt) * damp;

        // A particle that has flown absurdly far is brought back rather than
        // left to wander the whole canvas.
        const offset = Math.hypot(vx, vy);
        if (offset > MAX_OFFSET) {
          const k = MAX_OFFSET / offset;
          vx *= k;
          vy *= k;
        }
        if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
          vx = 0;
          vy = 0;
        }

        f.vx[i] = vx;
        f.vy[i] = vy;
      }
    }
  }

  /* ---------------------------------------------------------- interaction */

  const bandAt = (pt) => {
    let best = -1;
    for (let i = 0; i < fields.length; i++) {
      const b = fields[i].box;
      if (b && pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1) best = i;
    }
    return best;
  };

  bus.on('pointer', (detail) => {
    if (!stage) return;
    const at = detail.event ? { x: detail.x, y: detail.y } : null;
    const hit = at ? bandAt(at) : -1;
    hovered = hit >= 0 ? fields[hit].index : -1;
    canvas.style.cursor = hit >= 0 ? 'pointer' : '';
    // A still field — motion reduced — keeps its letters crisp. Dust is only
    // ever shed where the scene is running and can settle it again.
    pointer = stage.still ? null : at;
    if (stage.still) paint(stage);
  });

  canvas.addEventListener('click', (event) => {
    const pt = { x: event.clientX, y: event.clientY };
    const hit = bandAt(pt);
    if (hit < 0) return;
    const url = fields[hit].essay?.url;
    if (url) window.open(url, '_blank', 'noopener');
  });

  // Focusing a real link in the shelf lights its title.
  bus.on(SCENE.hover, (detail) => {
    const name = detail?.name || '';
    if (!name.startsWith('essay:')) return;
    const index = Number(name.split(':')[1]);
    focused = Number.isFinite(index) ? index : -1;
    if (shelf && focused >= 0) {
      const el = shelf.querySelector(`[data-sends="essay:${index}"]`);
      if (el instanceof HTMLElement && document.activeElement !== el) el.scrollIntoView({ block: 'nearest' });
    }
    if (stage?.still) paint(stage);
  });

  // The titles hand the page over over exactly the distance that was reserved
  // for them, so the essay list is never read through a title.
  function updateLayer(s) {
    const fadeEnd = Math.max(reserved * 0.8, s.h * 0.32);
    layer = 1 - Math.min(1, Math.max(0, s.scrollY / fadeEnd));
  }

  /* --------------------------------------------------------------- frame */

  function frame(dt, _t, s) {
    if (!s.still) step(dt);
    updateLayer(s);
    paint(s);
  }

  stage = createStage({
    canvas,
    name: 'titles',
    onResize: (s) => {
      W = s.w;
      H = s.h;
      build(s);
    },
    onFrame: frame,
  });
  if (!stage) return;

  // The display face must be ready before sampling, or the plates carry
  // fallback letterforms. Rebuild when the fonts land.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      build(stage);
      paint(stage);
    });
  }
  if (stage.still) paint(stage);
}
