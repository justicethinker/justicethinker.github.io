/**  * The solar system — the featured builds as planets around a warm sun.
  * Effect-local palette: independent of the site's silver/white theme.
 *
 * Six planets on tilted ellipses with Kepler-ish speeds (inner worlds run
 * faster), depth scaling so they pass behind and before the sun, hover and
 * tap to open a detail panel, drag to spin the whole system. Plain Canvas 2D,
 * no library.
 *
 * Repo data arrives as JSON in [data-orbit-data]; the panel is filled from
 * it, so the content model stays the single source of truth.
 */

const stage = document.querySelector('[data-orbit-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('[data-orbit-canvas]');
  const panel = stage.querySelector('[data-orbit-panel]');
  const dataEl = stage.querySelector('[data-orbit-data]');
  const prevBtn = stage.querySelector('[data-orbit-prev]');
  const nextBtn = stage.querySelector('[data-orbit-next]');
  const closeBtn = stage.querySelector('[data-orbit-close]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let repos = [];
  try {
    repos = JSON.parse(dataEl?.textContent || '[]');
  } catch {
    repos = [];
  }
  if (!Array.isArray(repos) || repos.length === 0) return;

  // Effect-local palette: this scene keeps its own warm hues,
  // deliberately independent of the site's silver/white theme.
  const EFFECT = {
    tints: ['#f0d878', '#d4af37', '#e8c96a', '#c9a227', '#f6e58d', '#b08d2a'],
    orbit: 'rgba(212,175,55,0.16)',
    haloHot: 'rgba(246,229,141,0.9)',
    haloMid: 'rgba(212,175,55,0.45)',
    haloFar: 'rgba(212,175,55,0)',
    sunCore: ['#f6e58d', '#d4af37', '#9a7b1e'],
    select: '#f0d878',
    hover: 'rgba(240,216,120,0.6)',
    crescent: '#fff8dd',
  };

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILT = 0.42; // orbit inclination: the pseudo-3D
  const N = repos.length;

  // One world per repo. Radius fractions spread the system; speeds fall off
  // like real orbits so the inner worlds hurry.
  const worlds = repos.map((repo, i) => ({
    repo,
    frac: 0.34 + (i / Math.max(N - 1, 1)) * 0.58,
    angle: (i / N) * Math.PI * 2 + 0.6,
    size: 11 - i * 0.7,
    tint: EFFECT.tints[i % EFFECT.tints.length],
  }));
  const speedBase = 0.16;
  const speedOf = (w) => speedBase * Math.pow(0.34 / w.frac, 1.5);

  let spin = 0; // extra angle from dragging, decays to zero
  let spinVel = 0;
  let zoom = 1; // scroll dives toward the sun, down to 0.6 and up to 2.4
  let zoomTarget = 1;
  const ZMIN = 0.6;
  const ZMAX = 2.4;
  let selected = -1;
  let hovered = -1;
  let visible = true;
  let W = 0;
  let H = 0;

  const stars = Array.from({ length: 130 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.3 + 0.3,
    a: Math.random() * 0.5 + 0.15,
  }));

  function fit() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(0);
  }

  const R = () => Math.min(W * 0.46, H * 0.44) * zoom;
  const cx = () => W / 2;
  const cy = () => H * 0.52;

  function worldPos(w) {
    const r = R() * w.frac;
    const a = w.angle + spin;
    return {
      x: cx() + r * Math.cos(a),
      y: cy() + r * Math.sin(a) * TILT,
      depth: Math.sin(a), // -1 behind … +1 before
    };
  }

  function paint() {
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Orbit paths.
    ctx.strokeStyle = EFFECT.orbit;
    ctx.lineWidth = 1;
    for (const w of worlds) {
      const r = R() * w.frac;
      ctx.beginPath();
      ctx.ellipse(cx(), cy(), r, r * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const placed = worlds.map((w, i) => ({ w, i, p: worldPos(w) }));

    // Worlds behind the sun first, then the sun, then the near worlds.
    for (const { w, i, p } of placed.filter((o) => o.p.depth < 0)) drawWorld(w, i, p);
    drawSun();
    for (const { w, i, p } of placed.filter((o) => o.p.depth >= 0)) drawWorld(w, i, p);

    canvas.dataset.system = 'live';
    canvas.dataset.zoom = zoom.toFixed(3);
  }

  function drawSun() {
    const r = Math.max(26, Math.min(W, H) * 0.055);
    const g = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), r * 3.2);
    g.addColorStop(0, EFFECT.haloHot);
    g.addColorStop(0.25, EFFECT.haloMid);
    g.addColorStop(1, EFFECT.haloFar);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx(), cy(), r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(cx() - r * 0.3, cy() - r * 0.3, r * 0.1, cx(), cy(), r);
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
  }

  function drawWorld(w, i, p) {
    const scale = 0.72 + ((p.depth + 1) / 2) * 0.55;
    const r = Math.max(4, w.size * scale * (W < 700 ? 0.85 : 1));
    const dim = 0.45 + ((p.depth + 1) / 2) * 0.55;

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
      ctx.lineWidth = i === selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Labels ride beside their worlds, fading with depth.
    ctx.globalAlpha = 0.35 + ((p.depth + 1) / 2) * 0.6;
    ctx.fillStyle = '#ffffff'; // words are white
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const short = w.repo.name.length > 18 ? w.repo.name.slice(0, 17) + '…' : w.repo.name;
    if (p.x < cx()) {
      ctx.textAlign = 'right';
      ctx.fillText(short, p.x - r - 8, p.y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(short, p.x + r + 8, p.y);
    }
    ctx.globalAlpha = 1;
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
  }

  function step(dir) {
    show(selected < 0 ? (dir > 0 ? 0 : N - 1) : (selected + dir + N) % N);
    paint();
  }

  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));
  closeBtn?.addEventListener('click', () => {
    show(-1);
    paint();
  });
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selected >= 0) {
      show(-1);
      paint();
    }
  });

  /* ---------------------------------------------------------- pointing */

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function pick(pt) {
    let best = -1;
    let bestD = 26;
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
    const pt = toLocal(event);
    if (dragging) {
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      moved += Math.abs(dx);
      spinVel = (dx / Math.max(W, 1)) * 2.2;
      spin += spinVel;
      if (reduce) paint();
      return;
    }
    const hit = pick(pt);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit >= 0 ? 'pointer' : '';
      paint();
    }
  });

  // Scroll dives. Fully zoomed out and still scrolling down hands the page
  // back, so the wheel is never trapped.
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (zoomTarget <= ZMIN && event.deltaY > 0) return;
      event.preventDefault();
      zoomTarget = Math.max(ZMIN, Math.min(ZMAX, zoomTarget * Math.exp(-event.deltaY * 0.0012)));
      if (reduce) {
        zoom = zoomTarget;
        paint();
      }
    },
    { passive: false },
  );

  stage.querySelector('[data-orbit-zoom-in]')?.addEventListener('click', () => {
    zoomTarget = Math.min(ZMAX, zoomTarget * 1.25);
    if (reduce) {
      zoom = zoomTarget;
      paint();
    }
  });
  stage.querySelector('[data-orbit-zoom-out]')?.addEventListener('click', () => {
    zoomTarget = Math.max(ZMIN, zoomTarget / 1.25);
    if (reduce) {
      zoom = zoomTarget;
      paint();
    }
  });

  const endPointer = (event) => {
    if (!dragging) return;
    dragging = false;
    // A press that barely moved is a tap, not a spin.
    if (moved < 8) {
      const hit = pick(toLocal(event));
      show(hit === selected ? -1 : hit);
      paint();
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });

  /* --------------------------------------------------------------- frame */

  fit();
  window.addEventListener('resize', fit, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  if (reduce) {
    show(0);
    paint();
    return;
  }

  let last = performance.now();
  let frames = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (!dragging) {
      spin += spinVel * dt * 8;
      spinVel *= 0.94;
      if (Math.abs(spinVel) < 0.0004) spinVel = 0;
    }
    for (const w of worlds) w.angle += speedOf(w) * dt;
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
    paint();
    canvas.dataset.frames = String(++frames);
  };
  requestAnimationFrame(loop);
}
