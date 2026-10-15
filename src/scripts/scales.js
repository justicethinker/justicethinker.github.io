/**
 * The scales — the whole page, and a record you can weigh.
 *
 * The beam fills the viewport but pivots low, so the copy at the top always
 * has clear space. The heavier pan goes **down**: the tilt is signed off the
 * weight difference, not against it.
 *
 * Results in the content layer are objects: drag one and drop it on a pan, or
 * press ← / → on a focused card, and the beam answers with its spring. The
 * four buttons in the panel do the same thing for anyone who prefers them.
 *
 * Effect-local palette: independent of the site's silver/white theme.
 */

import { createStage } from './stage.js';
import bus, { SCENE } from './bus.js';

const EFFECT = {
  pillar: 'rgba(212,175,55,0.5)',
  base: 'rgba(212,175,55,0.22)',
  panFor: '#f0d878',
  panAgainst: '#c8c9ce',
  beam: '#d4af37',
  glowHot: '#f6e58d',
  glowFar: 'rgba(212,175,55,0)',
  dish: 'rgba(212,175,55,0.08)',
  chain: 'rgba(255,255,255,0.4)',
};

const PAN_LABEL = { for: 'PROPOSITION', against: 'OPPOSITION' };

const stageEl = document.querySelector('[data-scale-stage]');
if (stageEl instanceof HTMLElement) boot(stageEl);

function boot(stageEl) {
  const canvas = stageEl.querySelector('[data-scale-canvas]');
  const readout = document.querySelector('[data-scale-readout]');
  const addFor = document.querySelector('[data-scale-add-for]');
  const addAgainst = document.querySelector('[data-scale-add-against]');
  const reset = document.querySelector('[data-scale-reset]');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  let data = [];
  try {
    data = JSON.parse(stageEl.querySelector('[data-scale-data]')?.textContent || '[]');
  } catch {
    data = [];
  }
  if (!Array.isArray(data)) data = [];

  let stage = null;
  const pans = { for: [], against: [] };
  data.forEach((item, i) => {
    pans[i % 2 === 0 ? 'for' : 'against'].push(item);
  });

  let angle = 0; // radians; negative tilts the proposition (left) pan down
  let vel = 0;
  let pointerSide = 0; // -1 leans left/proposition, +1 leans right/opposition
  let lastWeight = { for: 0, against: 0 };

  const total = () => pans.for.length + pans.against.length;
  const weightOf = (side) => (side === 'for' ? 1.05 : 1);
  const balance = () =>
    pans.for.length * weightOf('for') - pans.against.length * weightOf('against');

  // On a phone the pans sit higher, so the floating panel at the bottom does
  // not land on the labels.
  const pivot = (s) => ({ x: s.w / 2, y: s.h * (s.w < 860 ? 0.56 : 0.62) });
  const beamLen = (s) => Math.min(s.w * 0.62, s.h * 0.5);
  const chainDrop = (s) => Math.min(s.h * 0.16, 140);

  /* ---------------------------------------------------------------- paint */

  function paint(s) {
    const ctx = s.ctx;
    ctx.clearRect(0, 0, s.w, s.h);
    const p = pivot(s);
    const len = beamLen(s);

    const armX = Math.cos(angle) * (len / 2);
    const armY = Math.sin(angle) * (len / 2);
    const leftEnd = { x: p.x - armX, y: p.y - armY };
    const rightEnd = { x: p.x + armX, y: p.y + armY };

    // The pillar and its base.
    ctx.strokeStyle = EFFECT.pillar;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + s.h * 0.22);
    ctx.stroke();

    ctx.fillStyle = EFFECT.base;
    ctx.beginPath();
    ctx.moveTo(p.x - 58, p.y + s.h * 0.22);
    ctx.lineTo(p.x + 58, p.y + s.h * 0.22);
    ctx.lineTo(p.x + 26, p.y + s.h * 0.26);
    ctx.lineTo(p.x - 26, p.y + s.h * 0.26);
    ctx.closePath();
    ctx.fill();

    // Chains.
    ctx.strokeStyle = EFFECT.chain;
    ctx.lineWidth = 1;
    const drop = chainDrop(s);
    for (const end of [leftEnd, rightEnd]) {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x, end.y + drop);
      ctx.stroke();
    }

    drawPan(s, leftEnd, pans.for, EFFECT.panFor, PAN_LABEL.for, drop);
    drawPan(s, rightEnd, pans.against, EFFECT.panAgainst, PAN_LABEL.against, drop);

    // The beam last, so the weights hang under it.
    ctx.strokeStyle = EFFECT.beam;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leftEnd.x, leftEnd.y);
    ctx.lineTo(rightEnd.x, rightEnd.y);
    ctx.stroke();

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34);
    glow.addColorStop(0, EFFECT.glowHot);
    glow.addColorStop(1, EFFECT.glowFar);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.fill();

    canvas.dataset.scale = 'live';
    // Negative tilt means the proposition (left) pan is down — the heavier
    // side — which is the whole point of a balance.
    canvas.dataset.tilt = angle.toFixed(4);
    canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  }

  const shortLabel = (item) => {
    const placing = String(item?.placing || '★');
    return placing.split(' ')[0].slice(0, 10);
  };

  /**
   * Tags are laid out by measured width and wrapped into rows, so a long
   * placing can never clip against the next one or spill off the dish.
   */
  function drawPan(s, end, items, colour, label, drop) {
    const ctx = s.ctx;
    const y = end.y + drop;
    const w = Math.min(s.w * 0.36, 320);

    ctx.fillStyle = EFFECT.dish;
    ctx.beginPath();
    ctx.ellipse(end.x, y, w / 2, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();

    const shown = items.slice(0, 14);
    ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gap = 6;
    const pad = 9;
    const rows = [];
    let row = [];
    let rowW = 0;
    for (const item of shown) {
      const text = shortLabel(item);
      const bw = ctx.measureText(text).width + pad * 2;
      if (rowW + bw + gap > w && row.length) {
        rows.push({ row, width: rowW - gap });
        row = [];
        rowW = 0;
      }
      row.push({ text, w: bw });
      rowW += bw + gap;
    }
    if (row.length) rows.push({ row, width: rowW - gap });

    const rowH = 24;
    rows.forEach((entry, ri) => {
      let x = end.x - entry.width / 2;
      // Rows stack upward from the dish, nearest row lowest.
      const ty = y - 20 - (rows.length - 1 - ri) * (rowH + 4);
      for (const box of entry.row) {
        ctx.fillStyle = 'rgba(10,10,11,0.92)';
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x, ty - rowH / 2, box.w, rowH, 7);
        ctx.fill();
        ctx.stroke();
        // Text at full contrast inside the tag: the label is the point.
        ctx.fillStyle = '#ffffff';
        ctx.fillText(box.text, x + box.w / 2, ty + 1);
        x += box.w + gap;
      }
    });

    if (items.length > shown.length) {
      ctx.fillStyle = colour;
      ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(`+${items.length - shown.length} more`, end.x, y + 40);
    }

    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.95;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, end.x, y + (items.length > shown.length ? 58 : 40));
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /* --------------------------------------------------------------- state */

  function report() {
    const f = pans.for.length;
    const a = pans.against.length;
    if (readout) {
      const verdict =
        f === a
          ? `Even: ${f} each side.`
          : f > a
            ? `Proposition ${f}, Opposition ${a}.`
            : `Proposition ${f}, Opposition ${a}.`;
      if (readout.textContent !== verdict) readout.textContent = verdict;
    }
    canvas.dataset.scaleFor = String(f);
    canvas.dataset.scaleAgainst = String(a);
  }

  function step(dt) {
    // A positive balance means the proposition pan is heavier, and a heavier
    // pan goes down — which is a negative angle.
    const b = balance();
    const span = Math.max(2, total() * 0.9);
    const lean = pointerSide * 0.9;
    const raw = (b / span) * 0.42 * 2.4 + lean;
    const target = Math.max(-0.42, Math.min(0.42, -raw));

    const k = 26;
    const damp = 7.5;
    vel += (target - angle) * k * dt;
    vel *= Math.max(0, 1 - damp * dt);
    angle += vel * dt;
  }

  function settle(s) {
    // Run the spring to rest so a still frame is the settled frame.
    for (let i = 0; i < 90; i++) step(1 / 30);
    vel = 0;
    if (s) paint(s);
  }

  /* ----------------------------------------------------------- weighing */

  function weigh(side, index) {
    const item = Number.isFinite(index) && data[index] ? data[index] : null;
    if (!item) return false;
    if (pans[side].length >= data.length + 4) return false;
    pans[side].push(item);
    lastWeight[side] = index;
    report();
    if (stage?.still) settle(stage);
    return true;
  }

  bus.on(SCENE.weigh, (detail) => {
    if (!detail?.side) return;
    weigh(detail.side === 'against' ? 'against' : 'for', Number(detail.index));
  });

  addFor?.addEventListener('click', () => {
    const index = lastWeight.for % Math.max(1, data.length);
    if (weigh('for', index)) lastWeight.for = index + 1;
  });
  addAgainst?.addEventListener('click', () => {
    const index = lastWeight.against % Math.max(1, data.length);
    if (weigh('against', index)) lastWeight.against = index + 1;
  });
  reset?.addEventListener('click', () => {
    pans.for = [];
    pans.against = [];
    data.forEach((item, i) => pans[i % 2 === 0 ? 'for' : 'against'].push(item));
    lastWeight = { for: 0, against: 0 };
    report();
    if (stage?.still) settle(stage);
  });

  /* ---------------------------------------------------------- the record
     Result cards in the content layer are draggable objects. A card dropped on
     the left half weighs on the proposition pan, the right half on the
     opposition pan. ← / → do the same from the keyboard. */

  function initDraggableCards() {
    const cards = Array.from(document.querySelectorAll('[data-weigh-index]'));
    if (!cards.length) return;
    let chip = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let activeCard = null;

    const makeChip = (text) => {
      const el = document.createElement('div');
      el.className = 'weigh-chip';
      el.textContent = text;
      document.body.appendChild(el);
      return el;
    };

    const moveChip = (x, y) => {
      if (chip) {
        chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
    };

    const dropAt = (x, y) => {
      const side = x < window.innerWidth / 2 ? 'for' : 'against';
      const index = Number(activeCard?.getAttribute('data-weigh-index'));
      if (index >= 0) bus.emit(SCENE.weigh, { side, index });
      document.body.classList.remove('is-weighing');
      chip?.remove();
      chip = null;
      activeCard = null;
      dragging = false;
      void y;
    };

    for (const card of cards) {
      card.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        activeCard = card;
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        const title = card.querySelector('.card__name, h3, h2')?.textContent?.trim() || 'Result';
        chip = makeChip(title);
        moveChip(event.clientX, event.clientY);
        document.body.classList.add('is-weighing');
        card.setPointerCapture?.(event.pointerId);
      });

      card.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        moveChip(event.clientX, event.clientY);
      });

      card.addEventListener('pointerup', (event) => {
        if (!dragging) return;
        dropAt(event.clientX, event.clientY);
      });

      card.addEventListener('pointercancel', () => {
        chip?.remove();
        chip = null;
        activeCard = null;
        dragging = false;
        document.body.classList.remove('is-weighing');
      });

      card.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const side = event.key === 'ArrowLeft' ? 'for' : 'against';
        const index = Number(card.getAttribute('data-weigh-index'));
        bus.emit(SCENE.weigh, { side, index });
        // A visible answer for a keyboard user who cannot see the beam move.
        const live = document.querySelector('[data-scale-readout]');
        if (live) live.textContent += side === 'for' ? ' (weighed for.)' : ' (weighed against.)';
        void startX;
        void startY;
      });
    }
  }

  /* --------------------------------------------------------------- frame */

  function frame(dt, _t, s) {
    if (!s.still) step(dt);
    paint(s);
  }

  /**
   * Reserve the vertical room the balance occupies, in the content flow, so
   * the record's cards begin below the pans instead of on top of them.
   */
  function reserveStage(s) {
    const intro = document.querySelector('.opener');
    const bottom = pivot(s).y + chainDrop(s) + 70;
    const reserved = Math.max(s.h * 0.3, bottom - (intro ? intro.getBoundingClientRect().bottom : 0));
    document.documentElement.style.setProperty('--balance-stage', `${Math.round(reserved)}px`);
  }

  stage = createStage({
    canvas,
    name: 'scale',
    onResize: (s) => {
      reserveStage(s);
      settle(s);
      report();
    },
    onFrame: frame,
  });
  if (!stage) return;
  reserveStage(stage);

  // Pointer lean: the left half leans the proposition pan down.
  canvas.addEventListener('pointermove', (event) => {
    pointerSide = event.clientX < window.innerWidth / 2 ? -1 : 1;
    if (stage.still) {
      settle(stage);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointerSide = 0;
    if (stage.still) settle(stage);
  });

  initDraggableCards();
  settle(stage);
  report();
}
