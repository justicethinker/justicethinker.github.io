/**
 * The wave tank — now the whole page.
 *
 * The tank is a fixed, full-viewport canvas; every block of reading copy
 * stands *in* the water. Each `[data-wave-obstacle]` block is measured into a
 * mask, so content casts a real shadow in the interference pattern and gets a
 * bright rim where the field diffracts around it. Hovering a block nudges the
 * pattern near it.
 *
 * Two or three emitters radiate circular waves; where they meet they add. Drag
 * an emitter anywhere the pointer is not over a control. The frequency,
 * Add-a-source and Reset controls live in the floating panel.
 *
 * Plain Canvas 2D, no library. The field is summed per cell on a coarse grid
 * and blitted up. Effect-local palette: independent of the site's theme.
 */

import { createStage } from './stage.js';
import bus, { SCENE } from './bus.js';

const EFFECT = {
  bg: [12, 10, 8],
  peak: [228, 188, 90],
  ring: '#f0d878',
};

const wrapper = document.querySelector('[data-wave-stage]');
if (wrapper instanceof HTMLElement) boot(wrapper);

function boot(wrapper) {
  // The controls live in a floating panel outside the stage element,
  // so they are looked up on the document rather than inside the wrapper.
  const canvas = wrapper.querySelector('[data-wave-canvas]');
  const freq = document.querySelector('[data-wave-freq]');
  const addBtn = document.querySelector('[data-wave-add]');
  const resetBtn = document.querySelector('[data-wave-reset]');
  const pauseBtn = document.querySelector('[data-wave-pause]');
  const readout = document.querySelector('[data-wave-readout]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const sources = [
    { x: 0.3, y: 0.62, phase: 0 },
    { x: 0.7, y: 0.62, phase: 0 },
  ];

  let stage = null;
  let GW = 0;
  let GH = 0;
  let cw = 1; // px per grid cell, x
  let ch = 1; // px per grid cell, y
  let field = new Float32Array(0);
  let mask = new Uint8Array(0); // 0 open water, 1 inside content, 2 diffracting rim
  let wavelength = Number(freq?.value || 14); // grid cells per cycle
  let time = 0;
  let running = true;
  let dragIndex = -1;
  let wantsMask = true; // set on resize and scroll; rebuilt lazily, throttled

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  let img = null;

  /* ---------------------------------------------------------------- grid */

  function buildGrid(s) {
    const aspect = Math.max(0.35, s.w / s.h);
    const budget = s.tier === 'low' ? 13000 : 25000;
    GH = Math.max(64, Math.round(Math.sqrt(budget / aspect)));
    GW = Math.max(64, Math.round(GH * aspect));
    field = new Float32Array(GW * GH);
    mask = new Uint8Array(GW * GH);
    cw = s.w / GW;
    ch = s.h / GH;
    off.width = GW;
    off.height = GH;
    img = offCtx?.createImageData(GW, GH) ?? null;
    wantsMask = true;
    rebuildMask();
  }

  /**
   * Read the content blocks and burn them into the mask. Cost is one rect
   * test per cell, and it only runs when the page has actually moved.
   */
  function rebuildMask() {
    if (!wantsMask || !img) return;
    wantsMask = false;
    mask.fill(0);

    const rects = [];
    for (const el of document.querySelectorAll('[data-wave-obstacle]')) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12) continue;
      if (r.bottom < -40 || r.top > window.innerHeight + 40) continue;
      rects.push(r);
    }

    if (rects.length) {
      for (let gy = 0; gy < GH; gy++) {
        const py = gy * ch;
        const row = gy * GW;
        for (let gx = 0; gx < GW; gx++) {
          const px = gx * cw;
          for (let r = 0; r < rects.length; r++) {
            const b = rects[r];
            if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
              mask[row + gx] = 1;
              break;
            }
          }
        }
      }
      // Diffraction rim: open cells that touch a blocked cell.
      for (let gy = 1; gy < GH - 1; gy++) {
        const row = gy * GW;
        for (let gx = 1; gx < GW - 1; gx++) {
          const i = row + gx;
          if (mask[i]) continue;
          if (mask[i - 1] === 1 || mask[i + 1] === 1 || mask[i - GW] === 1 || mask[i + GW] === 1) {
            mask[i] = 2;
          }
        }
      }
    }

    hoverRect = null;
    hoverTarget = null;
  }

  /* --------------------------------------------------------------- field */

  const diagOf = (s) => Math.hypot(s.w, s.h);

  function paint(s) {
    if (!img) return;
    const t = s.still ? 2.2 : time;
    const lambdaPx = Math.max(4, wavelength * cw);
    const k = (Math.PI * 2) / lambdaPx;
    const diag = diagOf(s);
    const decayK = 5 / diag;
    const n = Math.max(1, sources.length);

    for (let gy = 0; gy < GH; gy++) {
      const py = gy * ch;
      const row = gy * GW;
      for (let gx = 0; gx < GW; gx++) {
        const px = gx * cw;
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const src = sources[i];
          const dx = px - src.x * s.w;
          const dy = py - src.y * s.h;
          const d = Math.sqrt(dx * dx + dy * dy);
          sum += Math.sin(d * k - t * 3 + src.phase) / (1 + d * decayK);
        }
        field[row + gx] = sum / n;
      }
    }

    // Content shadows and the bright rim where the field bends around it.
    if (hoverRect) {
      hoverLevel += ((hoverTarget ? 1 : 0) - hoverLevel) * 0.08;
      if (hoverLevel < 0.002 && !hoverTarget) hoverLevel = 0;
    }

    const data = img.data;
    for (let i = 0; i < field.length; i++) {
      let v = field[i];
      const m = mask[i];
      if (m === 1) v *= 0.22; // the block absorbs
      else if (m === 2) v = v * 0.7 + 0.34; // the rim glows

      if (hoverLevel > 0 && hoverRect) {
        const gx = i % GW;
        const gy = (i - gx) / GW;
        const px = gx * cw;
        const py = gy * ch;
        if (
          px >= hoverRect.left &&
          px <= hoverRect.right &&
          py >= hoverRect.top &&
          py <= hoverRect.bottom
        ) {
          v = v * 0.6 + hoverLevel * 0.42;
        }
      }

      const glow = Math.abs(v);
      const o = i * 4;
      data[o] = EFFECT.bg[0] + glow * EFFECT.peak[0];
      data[o + 1] = EFFECT.bg[1] + glow * EFFECT.peak[1];
      data[o + 2] = EFFECT.bg[2] + glow * EFFECT.peak[2];
      data[o + 3] = 255;
    }
    offCtx.putImageData(img, 0, 0);

    if (wantsMask) rebuildMask();

    // `s` rather than the outer `stage`: the first paint happens from inside
    // createStage, before that variable has been assigned.
    const ctx = s.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.drawImage(off, 0, 0, GW, GH, 0, 0, s.w, s.h);

    // Emitters ride on top of the water.
    for (const src of sources) {
      const x = src.x * s.w;
      const y = src.y * s.h;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = EFFECT.ring;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = EFFECT.ring;
      ctx.fill();
    }

    canvas.dataset.wave = 'live';
  }

  let hoverRect = null;
  let hoverTarget = null;
  let hoverLevel = 0;

  function frame(dt, _t, s) {
    if (!s.still) {
      if (!running) {
        // Paused: the readout still needs to be right, nothing else moves.
        return;
      }
      time += dt;
    }
    paint(s);
    canvas.dataset.frames = String((Number(canvas.dataset.frames || 0) + 1));
  }

  /* ---------------------------------------------------------- interaction */

  const eventPoint = (event) => ({ x: event.clientX, y: event.clientY });

  const nearSource = (p) => {
    let best = -1;
    let bestD = 44;
    sources.forEach((src, i) => {
      const x = src.x * stage.w;
      const y = src.y * stage.h;
      const d = Math.hypot(x - p.x, y - p.y);
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
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!stage) return;
    if (dragIndex < 0) {
      canvas.style.cursor = nearSource(eventPoint(event)) >= 0 ? 'grab' : '';
      return;
    }
    const p = eventPoint(event);
    sources[dragIndex].x = Math.min(0.97, Math.max(0.03, p.x / stage.w));
    sources[dragIndex].y = Math.min(0.96, Math.max(0.04, p.y / stage.h));
    publishSources();
    if (stage.still) paint(stage);
  });

  const endDrag = () => {
    dragIndex = -1;
    canvas.style.cursor = '';
    publishSources();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Tap the water to pause; tap again to resume. A keyboard user gets the
  // same switch on the panel's pause control.
  canvas.addEventListener('dblclick', () => {
    running = !running;
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', running ? 'false' : 'true');
      pauseBtn.textContent = running ? 'Pause' : 'Play';
    }
    if (stage?.still && running) paint(stage);
  });

  freq?.addEventListener('input', () => {
    wavelength = Number(freq.value);
    if (stage?.still) paint(stage);
  });

  addBtn?.addEventListener('click', () => {
    if (sources.length >= 3) return;
    sources.push({ x: 0.5, y: 0.34, phase: Math.PI / 2 });
    running = true;
    note();
    if (stage?.still) paint(stage);
  });

  // The keyboard equivalent of double-clicking the water to pause it.
  pauseBtn?.addEventListener('click', () => {
    running = !running;
    pauseBtn.setAttribute('aria-pressed', running ? 'false' : 'true');
    pauseBtn.textContent = running ? 'Pause' : 'Play';
    if (stage?.still && running) paint(stage);
  });

  resetBtn?.addEventListener('click', () => {
    sources.length = 0;
    sources.push({ x: 0.3, y: 0.62, phase: 0 }, { x: 0.7, y: 0.62, phase: 0 });
    running = true;
    note();
    if (stage?.still) paint(stage);
  });

  /* ------------------------------------------------- content ↔ tank */

  bus.on(SCENE.hover, (detail) => {
    if (!detail?.rect) {
      hoverTarget = null;
      hoverRect = null;
      return;
    }
    hoverTarget = detail.name;
    hoverRect = detail.rect;
  });

  window.addEventListener(
    'scroll',
    () => {
      wantsMask = true;
    },
    { passive: true },
  );

  /* --------------------------------------------------------------- note */

  /** Publish the emitter positions so the drag is observable from outside. */
  function publishSources() {
    canvas.dataset.waveSources = JSON.stringify(
      sources.map((s) => ({ x: Number(s.x.toFixed(4)), y: Number(s.y.toFixed(4)) })),
    );
  }

  function note() {
    publishSources();
    if (readout) {
      readout.textContent =
        sources.length === 1
          ? 'One source.'
          : `${sources.length} sources. Drag one to move it.`;
    }
    if (addBtn) addBtn.disabled = sources.length >= 3;
  }

  /* --------------------------------------------------------------- boot */

  stage = createStage({
    canvas,
    name: 'wave',
    onResize: buildGrid,
    onFrame: frame,
  });
  if (!stage) return;
  note();
  if (stage.still) paint(stage);
}
