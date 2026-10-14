/**
 * The scales — a debate record you can weigh.
 *
 * One warm beam on a pillar fills the screen. Every result hangs on the pan
 * it belongs to; add a weight to see the beam answer, or push the pointer at
 * one side and it leans that way. The beam is a spring-and-damper system: it
 * overshoots once and settles, the way a real balance does.
 *
 * Effect-local palette: independent of the site's silver/white theme.
 *
 * Plain Canvas 2D, no library.
 */

const stage = document.querySelector('[data-scale-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('[data-scale-canvas]');
  const readout = stage.querySelector('[data-scale-readout]');
  const addFor = stage.querySelector('[data-scale-add-for]');
  const addAgainst = stage.querySelector('[data-scale-add-against]');
  const reset = stage.querySelector('[data-scale-reset]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let data = [];
  try {
    data = JSON.parse(stage.querySelector('[data-scale-data]')?.textContent || '[]');
  } catch {
    data = [];
  }
  if (!Array.isArray(data)) data = [];

  // Effect-local palette: this balance keeps its own warm metal and silver
  // pan, deliberately independent of the site theme.
  const EFFECT = {
    pillar: 'rgba(212,175,55,0.5)',
    base: 'rgba(212,175,55,0.22)',
    panFor: '#f0d878',
    panAgainst: '#c8c9ce',
    beam: '#d4af37',
    glowHot: '#f6e58d',
    glowFar: 'rgba(212,175,55,0)',
    dish: 'rgba(212,175,55,0.08)',
  };

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Two pans. Results are dealt alternately so the beam starts alive.
  const pans = { for: [], against: [] };
  data.forEach((item, i) => {
    pans[i % 2 === 0 ? 'for' : 'against'].push(item);
  });

  let angle = 0; // radians, +tilts the proposition pan down
  let vel = 0;
  let pointerSide = 0; // -1 | 0 | 1
  let W = 0;
  let H = 0;
  let visible = true;
  let lastWeight = { for: 0, against: 0 };

  const total = () => pans.for.length + pans.against.length;
  const weightOf = (side) => (side === 'for' ? 1.05 : 1);

  function balance() {
    return pans.for.length * weightOf('for') - pans.against.length * weightOf('against');
  }

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 320);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  const pivot = () => ({ x: W / 2, y: H * 0.38 });
  const beamLen = () => Math.min(W * 0.72, H * 1.05);

  function paint() {
    ctx.clearRect(0, 0, W, H);

    const p = pivot();
    const len = beamLen();
    const armX = Math.cos(angle) * (len / 2);
    const armY = Math.sin(angle) * (len / 2);

    const leftEnd = { x: p.x - armX, y: p.y - armY };
    const rightEnd = { x: p.x + armX, y: p.y + armY };

    // The pillar and its base.
    ctx.strokeStyle = EFFECT.pillar;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + H * 0.34);
    ctx.stroke();

    ctx.fillStyle = EFFECT.base;
    ctx.beginPath();
    ctx.moveTo(p.x - 46, p.y + H * 0.34);
    ctx.lineTo(p.x + 46, p.y + H * 0.34);
    ctx.lineTo(p.x + 20, p.y + H * 0.38);
    ctx.lineTo(p.x - 20, p.y + H * 0.38);
    ctx.closePath();
    ctx.fill();

    // Chains.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (const end of [leftEnd, rightEnd]) {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x, end.y + H * 0.16);
      ctx.stroke();
    }

    // Pans.
    drawPan(leftEnd, pans.for, EFFECT.panFor, 'INDEX');
    drawPan(rightEnd, pans.against, EFFECT.panAgainst, 'OPPOSE');

    // The beam last, so weights sit under it.
    ctx.strokeStyle = EFFECT.beam;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftEnd.x, leftEnd.y);
    ctx.lineTo(rightEnd.x, rightEnd.y);
    ctx.stroke();

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
    glow.addColorStop(0, EFFECT.glowHot);
    glow.addColorStop(1, EFFECT.glowFar);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.fill();

    canvas.dataset.scale = 'live';
  }

  function drawPan(end, items, colour, label) {
    const y = end.y + H * 0.16;
    const w = Math.min(W * 0.3, 240);

    ctx.fillStyle = EFFECT.dish;
    ctx.beginPath();
    ctx.ellipse(end.x, y, w / 2, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Weight tags ride the pan: each one a result.
    items.forEach((item, i) => {
      const t = items.length === 1 ? 0.5 : i / (items.length - 1);
      const x = end.x - w / 2 + 26 + t * (w - 52);
      const ty = y - 6;
      ctx.fillStyle = 'rgba(10,10,11,0.9)';
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - 30, ty - 34, 60, 30, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colour;
      ctx.font = '700 16px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.placing?.split(' ')[0] ?? '★').slice(0, 8), x, ty - 18);
    });

    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.85;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, end.x, y + 42);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function report() {
    const f = pans.for.length;
    const a = pans.against.length;
    if (readout) {
      const verdict =
        f === a
          ? 'Balanced — the record weighs the same either way.'
          : f > a
            ? `Proposition side carries ${f} to ${a}.`
            : `Opposition side carries ${a} to ${f}.`;
      if (readout.textContent !== verdict) readout.textContent = verdict;
    }
    canvas.dataset.scaleFor = String(f);
  }

  function step(dt) {
    // Target tilt from the weights, plus a nudge from the pointer.
    const b = balance() + pointerSide * 0.9;
    const span = Math.max(2, total() * 0.9);
    const target = Math.max(-0.42, Math.min(0.42, (b / span) * 0.42 * 2.4));

    // Spring toward target, damped: one overshoot, then still.
    const k = 26;
    const damp = 7.5;
    vel += (target - angle) * k * dt;
    vel *= Math.max(0, 1 - damp * dt);
    angle += vel * dt;
  }

  /* ---------------------------------------------------------- interaction */

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  canvas.addEventListener('pointermove', (event) => {
    const pt = toLocal(event);
    pointerSide = pt.x < W / 2 ? 1 : -1;
    if (reduce) {
      for (let s = 0; s < 40; s++) step(1 / 30);
      paint();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointerSide = 0;
  });

  addFor?.addEventListener('click', () => {
    if (pans.for.length >= data.length) return;
    pans.for.push(data[lastWeight.for % data.length]);
    lastWeight.for++;
    report();
    if (reduce) settle();
  });
  addAgainst?.addEventListener('click', () => {
    if (pans.against.length >= data.length) return;
    pans.against.push(data[lastWeight.against % data.length]);
    lastWeight.against++;
    report();
    if (reduce) settle();
  });
  reset?.addEventListener('click', () => {
    pans.for = [];
    pans.against = [];
    data.forEach((item, i) => pans[i % 2 === 0 ? 'for' : 'against'].push(item));
    lastWeight = { for: 0, against: 0 };
    report();
    if (reduce) settle();
  });

  function settle() {
    for (let s = 0; s < 60; s++) step(1 / 30);
    vel = 0;
    paint();
  }

  /* --------------------------------------------------------------- frame */

  fit();
  settle();
  report();
  window.addEventListener('resize', fit, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  if (reduce) return;

  let last = performance.now();
  let frames = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    step(dt);
    paint();
    canvas.dataset.frames = String(++frames);
  };
  requestAnimationFrame(loop);
}
