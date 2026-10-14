/**
 * The tug-of-war — an argument as a field of forces.
 *
 * Two poles, Proposition (gold, left) and Opposition (silver, right), pull
 * ~400 particles between them. Each particle feels both attractions plus
 * damping and settles where the pulls balance. The pointer joins whichever
 * side it stands nearer to; two buttons fire a pulse from either side for
 * keyboard and touch users. A live meter shows the split and decays to 50/50
 * at rest, the way a room settles after the speeches end.
 */

const stage = document.querySelector('[data-tug-stage]');
if (stage instanceof HTMLElement) boot(stage);

function boot(stage) {
  const canvas = stage.querySelector('[data-tug-canvas]');
  const meter = stage.querySelector('[data-tug-meter]');
  const barFor = stage.querySelector('[data-tug-bar-for]');
  const forBtn = stage.querySelector('[data-tug-for]');
  const againstBtn = stage.querySelector('[data-tug-against]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COUNT = window.innerWidth < 700 ? 220 : 420;

  const px = new Float32Array(COUNT);
  const py = new Float32Array(COUNT);
  const vx = new Float32Array(COUNT);
  const vy = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const gold = new Uint8Array(COUNT); // 1 = leans proposition, 0 = opposition

  for (let i = 0; i < COUNT; i++) {
    px[i] = Math.random();
    py[i] = Math.random();
    size[i] = Math.random() * 1.6 + 0.7;
  }

  let W = 0;
  let H = 0;
  let pointer = null; // {x, y} in unit space, or null
  let pulseFor = 0; // extra pull, decays
  let pulseAgainst = 0;
  let lean = 0; // -1 (opposition) … +1 (proposition), smoothed
  let visible = true;

  const poleL = { x: 0.12 };
  const poleR = { x: 0.88 };

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(rect.width, 1);
    H = Math.max(rect.height, 260);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  const poleY = () => 0.5;

  function paint() {
    ctx.clearRect(0, 0, W, H);

    // The rope: a line between the poles that sags toward whoever is winning.
    const yMid = H * poleY() + lean * H * 0.1;
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * poleL.x, H * poleY());
    ctx.quadraticCurveTo(W / 2, yMid + H * 0.06, W * poleR.x, H * poleY());
    ctx.stroke();

    // Centre mark.
    ctx.fillStyle = 'rgba(236,231,219,0.4)';
    ctx.fillRect(W / 2 - 1, H * poleY() - 14, 2, 28);

    drawPole(poleL.x, true);
    drawPole(poleR.x, false);

    for (let i = 0; i < COUNT; i++) {
      const x = px[i] * W;
      const y = py[i] * H;
      ctx.fillStyle = gold[i] ? 'rgba(240,216,120,0.85)' : 'rgba(200,201,206,0.7)';
      ctx.beginPath();
      ctx.arc(x, y, size[i], 0, Math.PI * 2);
      ctx.fill();
    }

    canvas.dataset.tug = 'live';
  }

  function drawPole(fx, isGold) {
    const x = W * fx;
    const y = H * poleY();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 46);
    glow.addColorStop(0, isGold ? 'rgba(240,216,120,0.8)' : 'rgba(200,201,206,0.7)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isGold ? '#f0d878' : '#c8c9ce';
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isGold ? 'FOR' : 'AGAINST', x, y - 58);
  }

  function step(dt) {
    pulseFor *= Math.pow(0.4, dt);
    pulseAgainst *= Math.pow(0.4, dt);
    if (pulseFor < 0.01) pulseFor = 0;
    if (pulseAgainst < 0.01) pulseAgainst = 0;

    const yC = poleY();
    let forCount = 0;

    for (let i = 0; i < COUNT; i++) {
      // Pull toward each pole, stronger when close (capped to avoid slingshots).
      const dxL = poleL.x - px[i];
      const dyL = yC - py[i];
      const dxR = poleR.x - px[i];
      const dyR = yC - py[i];
      const dL = Math.max(0.06, Math.hypot(dxL, dyL));
      const dR = Math.max(0.06, Math.hypot(dxR, dyR));

      let pullL = (0.55 / (dL * dL) + pulseFor * 3) * dt;
      let pullR = (0.55 / (dR * dR) + pulseAgainst * 3) * dt;

      if (pointer) {
        const dxP = pointer.x - px[i];
        const dyP = pointer.y - py[i];
        const dP = Math.max(0.05, Math.hypot(dxP, dyP));
        // The pointer joins its nearer side: it drags particles with it.
        const side = pointer.x < 0.5 ? 1 : -1;
        const f = ((0.3 - Math.min(dP, 0.3)) / 0.3) * 2.4 * dt;
        if (side > 0) pullL += f;
        else pullR += f;
      }

      vx[i] = (vx[i] + (dxL / dL) * pullL + (dxR / dR) * pullR) * 0.94;
      vy[i] = (vy[i] + (dyL / dL) * pullL + (dyR / dR) * pullR) * 0.94;
      px[i] += vx[i] * dt * 8;
      py[i] += vy[i] * dt * 8;

      // Soft walls.
      if (px[i] < 0.02) { px[i] = 0.02; vx[i] *= -0.5; }
      if (px[i] > 0.98) { px[i] = 0.98; vx[i] *= -0.5; }
      if (py[i] < 0.05) { py[i] = 0.05; vy[i] *= -0.5; }
      if (py[i] > 0.95) { py[i] = 0.95; vy[i] *= -0.5; }

      if (px[i] < 0.5) {
        gold[i] = 1;
        forCount++;
      } else {
        gold[i] = 0;
      }
    }

    const target = (forCount / COUNT) * 2 - 1;
    lean += (target - lean) * Math.min(1, dt * 3);
    report(forCount);
  }

  // A width write restarts the fill's CSS transition, which the audit counts
  // as a running animation — so write only when the rounded value changes.
  // (The lean easing already smooths the motion; no transition is needed.)
  let shownPct = -1;
  function report(forCount) {
    const pct = Math.round((forCount / COUNT) * 100);
    if (meter) {
      const label = pct === 50 ? 'Dead even' : pct > 50 ? `For leads ${pct}–${100 - pct}` : `Against leads ${100 - pct}–${pct}`;
      if (meter.textContent !== label) meter.textContent = label;
    }
    if (pct !== shownPct) {
      shownPct = pct;
      if (barFor) barFor.style.width = `${pct}%`;
      canvas.dataset.split = String(pct);
    }
  }

  /* ---------------------------------------------------------- interaction */

  const toUnit = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  canvas.addEventListener('pointermove', (event) => {
    pointer = toUnit(event);
    if (reduce) {
      step(1 / 30);
      paint();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
  });

  forBtn?.addEventListener('click', () => {
    pulseFor = Math.min(pulseFor + 1.6, 3);
    if (reduce) {
      // Reduced motion still answers, once: shove and settle immediately.
      for (let s = 0; s < 40; s++) step(1 / 30);
      paint();
    }
  });
  againstBtn?.addEventListener('click', () => {
    pulseAgainst = Math.min(pulseAgainst + 1.6, 3);
    if (reduce) {
      for (let s = 0; s < 40; s++) step(1 / 30);
      paint();
    }
  });

  /* --------------------------------------------------------------- frame */

  fit();
  // Compose the opening frame at rest so first paint is already an argument.
  for (let s = 0; s < 60; s++) step(1 / 30);
  paint();
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
