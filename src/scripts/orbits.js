/**
 * The solar system — the whole page.
 *
 * Six worlds on tilted ellipses with Kepler-ish speeds (inner worlds hurry),
 * depth scaling so they pass behind and before the sun. The scene fills the
 * viewport: there is room for the orbits to breathe.
 *
 * The dive is driven by **scroll progress**, never by swallowing the wheel —
 * the page always scrolls normally and the system zooms as it does.
 *
 * Labels collision-avoid: each one tries right, left, above and below its
 * world, refuses to overlap a label already placed or the intro copy, and
 * simply does not draw if there is nowhere clean to go. The focused world
 * always gets its label first.
 *
 * The repo list is a fixed HUD of real links; hovering or focusing one pulls
 * its planet forward. Effect-local palette: independent of the site's theme.
 */

import { createStage } from './stage.js';
import bus, { SCENE } from './bus.js';

const EFFECT = {
  tints: ['#f0d878', '#d4af37', '#e8c96a', '#c9a227', '#f6e58d', '#b08d2a'],
  orbit: 'rgba(212,175,55,0.16)',
  orbitHot: 'rgba(240,216,120,0.42)',
  haloHot: 'rgba(246,229,141,0.9)',
  haloMid: 'rgba(212,175,55,0.45)',
  haloFar: 'rgba(212,175,55,0)',
  sunCore: ['#f6e58d', '#d4af37', '#9a7b1e'],
  select: '#f0d878',
  hover: 'rgba(240,216,120,0.75)',
  crescent: '#fff8dd',
  label: '#ffffff',
  labelDim: 'rgba(255,255,255,0.72)',
};

const stageEl = document.querySelector('[data-orbit-stage]');
if (stageEl instanceof HTMLElement) boot(stageEl);

function boot(stageEl) {
  const canvas = stageEl.querySelector('[data-orbit-canvas]');
  const dataEl = stageEl.querySelector('[data-orbit-data]');
  // The panel sits beside the content layer, not inside the stage wrapper, so
  // a line of the page's own copy can never be painted over it.
  const panel = document.querySelector('[data-orbit-panel]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  let repos = [];
  try {
    repos = JSON.parse(dataEl?.textContent || '[]');
  } catch {
    repos = [];
  }
  if (!Array.isArray(repos) || repos.length === 0) return;

  const prevBtn = document.querySelector('[data-orbit-prev]');
  const nextBtn = document.querySelector('[data-orbit-next]');
  const closeBtn = document.querySelector('[data-orbit-close]');
  const intro = document.querySelector('[data-orbit-intro]');

  // Blocks of page copy the labels must keep out of — the opener, and anything
  // the markup marks with data-orbit-avoid (the record heading, the dive bar,
  // the open panel). Stored in document space so the fixed canvas can slide
  // them by the scroll each frame without reading layout 60 times a second.
  let blockers = [];
  function measureBlockers() {
    const els = [intro, ...document.querySelectorAll('[data-orbit-avoid]')].filter(Boolean);
    blockers = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 8) continue; // hidden panel, collapsed block
      blockers.push({
        x0: r.left - 10,
        x1: r.right + 10,
        y0: r.top + window.scrollY - 10,
        y1: r.bottom + window.scrollY + 10,
      });
    }
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILT = 0.42;
  const N = repos.length;

  const worlds = repos.map((repo, i) => ({
    repo,
    frac: 0.3 + (i / Math.max(N - 1, 1)) * 0.62,
    angle: (i / N) * Math.PI * 2 + 0.6,
    size: 12 - i * 0.7,
    tint: EFFECT.tints[i % EFFECT.tints.length],
    pull: 0, // eased 0→1 while the visitor is over this repo in the HUD
  }));

  const speedBase = 0.16;
  const speedOf = (w) => speedBase * Math.pow(0.3 / w.frac, 1.5);

  let stage = null;
  let spin = 0;
  let spinVel = 0;
  let zoom = 1;
  let zoomTarget = 1;
  const ZMAX = 2.4;
  let selected = -1;
  let hovered = -1;
  let W = 0;
  let H = 0;

  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.3 + 0.3,
    a: Math.random() * 0.45 + 0.28,
  }));

  const R = () => Math.min(W * 0.46, H * 0.44) * zoom;
  const cx = () => W / 2;
  const cy = () => H / 2;

  function worldPos(w) {
    const r = R() * w.frac;
    const a = w.angle + spin;
    return {
      x: cx() + r * Math.cos(a),
      y: cy() + r * Math.sin(a) * TILT,
      depth: Math.sin(a),
    };
  }

  /* -------------------------------------------------- label placement */

  const overlaps = (a, b) =>
    a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  const blocked = (rect, avoid) => !!avoid && avoid.some((box) => overlaps(rect, box));

  function placeLabel(ctx, text, p, r, taken, avoid) {
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const h = 9;
    const pad = 4;

    const candidates = [
      { x: p.x + r + 9, y: p.y, align: 'left' },
      { x: p.x - r - 9, y: p.y, align: 'right' },
      { x: p.x, y: p.y - r - 15, align: 'center' },
      { x: p.x, y: p.y + r + 16, align: 'center' },
    ];

    for (const c of candidates) {
      const x0 =
        c.align === 'left' ? c.x - pad : c.align === 'right' ? c.x - tw - pad : c.x - tw / 2 - pad;
      const rect = { x0, x1: x0 + tw + pad * 2, y0: c.y - h, y1: c.y + h };
      if (rect.x0 < 6 || rect.x1 > W - 6 || rect.y0 < 6 || rect.y1 > H - 6) continue;
      if (taken.some((t) => overlaps(rect, t))) continue;
      if (blocked(rect, avoid)) continue;
      taken.push(rect);
      return { ...c, text };
    }
    return null;
  }

  /* -------------------------------------------------------------- paint */

  function paint(s) {
    const ctx = s.ctx;
    ctx.clearRect(0, 0, W, H);

    for (const star of stars) {
      ctx.globalAlpha = star.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Orbit paths.
    ctx.lineWidth = 1;
    for (const w of worlds) {
      const r = R() * w.frac;
      ctx.strokeStyle = w.pull > 0.05 ? EFFECT.orbitHot : EFFECT.orbit;
      ctx.beginPath();
      ctx.ellipse(cx(), cy(), r, r * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const placed = worlds.map((w, i) => ({ w, i, p: worldPos(w) }));
    for (const { w, i, p } of placed.filter((o) => o.p.depth < 0)) drawWorld(s, w, i, p);
    drawSun(s);
    for (const { w, i, p } of placed.filter((o) => o.p.depth >= 0)) drawWorld(s, w, i, p);

    // Labels last, so they are never painted over. The focused world asks
    // first, then the rest in order of how close they are to the viewer.
    const taken = [];
    // Page copy the labels must not write over: the opener and anything marked
    // data-orbit-avoid. Cached in document space, then slid by the scroll, so a
    // label never lands on a heading and no layout is read on the frame path.
    const avoid = blockers
      .map((b) => ({ x0: b.x0, x1: b.x1, y0: b.y0 - s.scrollY, y1: b.y1 - s.scrollY }))
      .filter((b) => b.y1 > -80 && b.y0 < H + 80);

    const order = [...placed.keys()].sort((a, b) => {
      const rank = (i) => (i === hovered || i === selected ? 2 : 0) + (placed[i].p.depth + 1) / 2;
      return rank(b) - rank(a);
    });

    for (const i of order) {
      const { w, p } = placed[i];
      const r = radiusOf(w, p, s);
      const short = w.repo.name.length > 18 ? `${w.repo.name.slice(0, 17)}…` : w.repo.name;
      const spot = placeLabel(ctx, short, p, r, taken, avoid);
      if (!spot) continue;
      const active = i === hovered || i === selected;
      ctx.globalAlpha = active ? 1 : 0.8;
      ctx.fillStyle = active ? EFFECT.label : EFFECT.labelDim;
      ctx.textAlign = spot.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(spot.text, spot.x, spot.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    canvas.dataset.system = 'live';
    canvas.dataset.zoom = zoom.toFixed(3);
    canvas.dataset.focus = hovered >= 0 ? String(hovered) : '';
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }

  function radiusOf(w, p, s) {
    const scale = 0.72 + ((p.depth + 1) / 2) * 0.55;
    return Math.max(4, w.size * scale * (W < 700 ? 0.85 : 1)) * (1 + w.pull * 0.22);
  }

  function drawSun(s) {
    const ctx = s.ctx;
    const r = Math.max(26, Math.min(W, H) * 0.055);
    const g = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), r * 3.2);
    g.addColorStop(0, EFFECT.haloHot);
    g.addColorStop(0.25, EFFECT.haloMid);
    g.addColorStop(1, EFFECT.haloFar);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx(), cy(), r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(
      cx() - r * 0.3,
      cy() - r * 0.3,
      r * 0.1,
      cx(),
      cy(),
      r,
    );
    core.addColorStop(0, EFFECT.sunCore[0]);
    core.addColorStop(0.6, EFFECT.sunCore[1]);
    core.addColorStop(1, EFFECT.sunCore[2]);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx(), cy(), r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(20,16,4,0.85)';
    ctx.font = '700 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JT', cx(), cy() + 1);
    ctx.textAlign = 'left';
  }

  function drawWorld(s, w, i, p) {
    const ctx = s.ctx;
    const r = radiusOf(w, p, s);
    const dim = 0.5 + ((p.depth + 1) / 2) * 0.5;

    if (w.pull > 0.02) {
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4);
      halo.addColorStop(0, `rgba(240,216,120,${0.34 * w.pull})`);
      halo.addColorStop(1, 'rgba(240,216,120,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = dim;
    ctx.fillStyle = w.tint;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Lit crescent facing the sun.
    ctx.globalAlpha = dim * 0.9;
    ctx.fillStyle = EFFECT.crescent;
    ctx.beginPath();
    ctx.arc(p.x - r * 0.28, p.y - r * 0.28, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (i === selected || i === hovered) {
      ctx.strokeStyle = i === selected ? EFFECT.select : EFFECT.hover;
      ctx.lineWidth = i === selected ? 2 : 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6 + w.pull * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ---------------------------------------------------------- selection */

  function show(i) {
    selected = i;
    if (!(panel instanceof HTMLElement)) return;
    if (i < 0) {
      panel.hidden = true;
      return;
    }
    const repo = repos[i];
    const name = panel.querySelector('[data-orbit-name]');
    const meta = panel.querySelector('[data-orbit-meta]');
    const body = panel.querySelector('[data-orbit-body]');
    const link = panel.querySelector('[data-orbit-link]');
    if (name) name.textContent = repo.name;
    if (meta) meta.textContent = repo.language;
    if (body) body.textContent = repo.body;
    if (link instanceof HTMLAnchorElement) link.href = repo.url;
    panel.hidden = false;
    canvas.dataset.selected = String(i);
  }

  function step(dir) {
    show(selected < 0 ? (dir > 0 ? 0 : N - 1) : (selected + dir + N) % N);
    if (stage?.still) paint(stage);
  }

  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));
  closeBtn?.addEventListener('click', () => {
    show(-1);
    if (stage?.still) paint(stage);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selected >= 0) {
      show(-1);
      if (stage?.still) paint(stage);
    }
  });

  /* ---------------------------------------------------------- pointing */

  function pick(pt) {
    let best = -1;
    let bestD = 30;
    worlds.forEach((w, i) => {
      const p = worldPos(w);
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  let dragging = false;
  let moved = 0;
  let lastX = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!stage) return;
    const pt = stage.toLocal(event.clientX, event.clientY);
    if (dragging) {
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      moved += Math.abs(dx);
      spinVel = (dx / Math.max(W, 1)) * 2.2;
      spin += spinVel;
      if (stage.still) paint(stage);
      return;
    }
    const hit = pick(pt);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit >= 0 ? 'pointer' : '';
      if (stage.still) paint(stage);
    }
  });

  const endPointer = (event) => {
    if (!dragging) return;
    dragging = false;
    // A press that barely moved is a tap, not a spin.
    if (moved < 8) {
      const pt = stage.toLocal(event.clientX, event.clientY);
      const hit = pick(pt);
      show(hit === selected ? -1 : hit);
      if (stage?.still) paint(stage);
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });

  // The dive belongs to the page, so the buttons move the page rather than
  // fighting the scroll mapping for control of the zoom.
  const nudge = (dir) => {
    const step = Math.max(220, window.innerHeight * 0.4) * dir;
    window.scrollBy({ top: step, behavior: reduce ? 'auto' : 'smooth' });
  };
  document.querySelector('[data-orbit-zoom-in]')?.addEventListener('click', () => nudge(1));
  document.querySelector('[data-orbit-zoom-out]')?.addEventListener('click', () => nudge(-1));

  /* ------------------------------------------- content ↔ scene: the list */

  bus.on(SCENE.hover, (detail) => {
    const name = detail?.name || '';
    if (!name.startsWith('planet:')) {
      // Leaving the list (or leaving the panel entirely) releases the focus.
      if (!name) {
        hovered = -1;
        if (stage?.still) paint(stage);
      }
      return;
    }
    const index = Number(name.split(':')[1]);
    hovered = Number.isFinite(index) ? index : -1;
    if (stage?.still) paint(stage);
  });


  /* --------------------------------------------------------------- frame */

  // The dive follows the page: scrolling zooms the system in from its full
  // size, and nothing is swallowed from the wheel, so the reader is never
  // trapped. Every pixel of scroll means a definite amount of dive.
  function diveFromScroll(s) {
    const span = Math.max(320, s.h * 0.9);
    const t = Math.min(1, s.scrollY / span);
    zoomTarget = 1 + (ZMAX - 1) * t;
    if (s.still) zoom = zoomTarget;
  }

  function frame(dt, _t, s) {
    diveFromScroll(s);
    for (const w of worlds) {
      const want = w === worlds[hovered] ? 1 : 0;
      w.pull += (want - w.pull) * Math.min(1, dt * 8);
    }
    if (!s.still) {
      if (!dragging) {
        spin += spinVel * dt * 8;
        spinVel *= 0.94;
        if (Math.abs(spinVel) < 0.0004) spinVel = 0;
      }
      for (const w of worlds) w.angle += speedOf(w) * dt;
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
    }
    paint(s);
  }

  stage = createStage({
    canvas,
    name: 'orbit',
    onResize: (s) => {
      W = s.w;
      H = s.h;
      measureBlockers();
    },
    onFrame: frame,
  });
  if (!stage) return;
  if (stage.still) show(0);

  // A late font or image reflows the page under the cached blockers.
  window.addEventListener('load', measureBlockers, { once: true });
  document.fonts?.ready.then(measureBlockers);
  void reduce;
}
