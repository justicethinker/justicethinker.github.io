/**
 * Exercise the site's interactive layer through the interface a visitor uses.
 *
 * A green audit only proves the pages render; this drives the actual controls
 * over the DevTools protocol — the 3D hero field, the menu, the tilt cards,
 * the wave tank, the portrait slot and back-to-top — and asserts observable
 * behaviour, so a control that renders but does nothing cannot pass.
 *
 *   node tools/check-interactions.mjs
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const CHROME = join(
  process.env.HOME || '/home/justicethinker',
  '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = normalize(decodeURIComponent(url.pathname));
    if (rel.endsWith('/')) rel += 'index.html';
    const file = join(dist, rel);
    if (!file.startsWith(dist)) return void res.writeHead(403).end();
    const info = await stat(file);
    if (info.isDirectory()) return void res.writeHead(404).end();
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const CDP_PORT = Number(process.env.CHECK_CDP_PORT || 9401);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/check-profile-${CDP_PORT}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

let chromeErr = '';
chrome.stderr.on('data', (c) => (chromeErr += c.toString()));

async function waitForPageTarget(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) {
        const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no CDP target on ${CDP_PORT}\n${chromeErr.slice(-600)}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP socket error')));
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  return {
    ws,
    ready,
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
  };
}

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '}${name}${detail ? `  — ${detail}` : ''}`);
};

try {
  const cdp = connect(await waitForPageTarget());
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const evaluate = async (expression) => {
    const out = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text);
    return out.result.value;
  };

  const open = async (path, width = 1440) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 500,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
    await new Promise((r) => setTimeout(r, 1500));
  };

  /* ------------------------------------------------------- home: hero 3D */
  await open('/');

  // The hero must actually run: a live WebGL context and a frame counter that
  // keeps climbing. A canvas that exists but never renders fails here.
  const hero = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-hero-field]');
    const importmap = document.querySelector('script[type="importmap"]');
    const rect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
    const first = Number(canvas?.dataset.frames || 0);
    await new Promise((r) => setTimeout(r, 900));
    const second = Number(canvas?.dataset.frames || 0);
    const gl = canvas ? (canvas.getContext('webgl2') || canvas.getContext('webgl')) : null;
    return {
      canvas: !!canvas,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      threePinned: (importmap?.textContent || '').includes('three@'),
      // The frame holds either the owner's photograph or the monogram that
      // reserves its seat — never an empty box, never a broken image.
      portrait: (() => {
        const photo = document.querySelector('.portrait__inner img');
        if (photo instanceof HTMLImageElement) {
          return photo.complete && photo.naturalWidth > 0;
        }
        return !!document.querySelector('[data-portrait-empty]');
      })(),
      tiltCards: document.querySelectorAll('[data-tilt]').length,
      live: canvas?.dataset.field === 'live',
      particles: Number(canvas?.dataset.particles || 0),
      framesClimbing: second > first,
      glAlive: !!gl && !gl.isContextLost(),
    };
  })()`);
  record(
    'the 3D hero field is live — WebGL context up and frames climbing',
    hero.canvas && hero.live && hero.framesClimbing && hero.glAlive && hero.particles >= 300,
    `${hero.width}x${hero.height} particles=${hero.particles} live=${hero.live} climbing=${hero.framesClimbing}`,
  );
  record(
    'the portrait slot and tilt cards are on the home page',
    hero.portrait && hero.tiltCards >= 3 && hero.threePinned,
    `tilt=${hero.tiltCards} portraitSlot=${hero.portrait} threePinned=${hero.threePinned}`,
  );

  // The stage is the page: the field canvas must cover the whole viewport and
  // stay behind the content, not sit in a hero box.
  const fieldStage = await evaluate(`(() => {
    const canvas = document.querySelector('[data-hero-field]');
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas.closest('.stage'));
    return {
      full: rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2,
      fixed: style.position === 'fixed',
    };
  })()`);
  record(
    'the field is a fixed, full-viewport stage behind the content',
    fieldStage.full && fieldStage.fixed,
    `full=${fieldStage.full} fixed=${fieldStage.fixed}`,
  );

  // Hovering a register card must reach into the field: particles heat up and
  // are pulled toward the card.
  const pull = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-hero-field]');
    const card = document.querySelector('[data-sends="register:tech"]');
    if (!canvas || !card) return { found: false };
    const idle = { attract: canvas.dataset.attract, lit: Number(canvas.dataset.lit || 0) };
    const rect = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    card.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
    await new Promise((r) => setTimeout(r, 250));
    const early = Number(canvas.dataset.pull || 0);
    await new Promise((r) => setTimeout(r, 1200));
    const state = { attract: canvas.dataset.attract, lit: Number(canvas.dataset.lit || 0) };
    const late = Number(canvas.dataset.pull || 0);
    card.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    return { found: true, idle, state, early, late };
  })()`);
  record(
    'hovering a register card pulls the field toward it',
    pull.found && pull.state.attract === 'on' && pull.state.lit > 0 && pull.late < pull.early,
    pull.found
      ? `lit=${pull.state.lit} (idle ${pull.idle.lit}), mean distance ${pull.early}→${pull.late}`
      : 'no card found',
  );

  // The tilt is a real transform: park the pointer on a card and read it back.
  const tilt = await evaluate(`(async () => {
    const card = document.querySelector('.card[data-tilt]');
    if (!card) return { found: false };
    const rect = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: rect.left + rect.width * 0.8,
      clientY: rect.top + rect.height * 0.2,
    }));
    await new Promise((r) => setTimeout(r, 300));
    const t = card.style.transform || '';
    card.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    return { found: true, leaned: t.includes('rotateY') };
  })()`);
  record(
    'cards lean toward the pointer in 3D',
    tilt.found && tilt.leaned,
    tilt.found ? `transform applied: ${tilt.leaned}` : 'no tilt card found',
  );

  /* ------------------------------------------------------------ masthead nav */
  const chromeBits = await evaluate(`(() => {
    const current = Array.from(document.querySelectorAll('.nav__link[aria-current="page"]')).map((a) => a.textContent.trim());
    const skip = document.querySelector('.skip');
    const first = document.body.querySelector('a, button');
    return {
      current,
      skipHref: skip?.getAttribute('href') || '',
      skipFirst: first === skip,
      main: !!document.querySelector('main#main'),
      links: Array.from(document.querySelectorAll('.nav__link')).map((a) => a.textContent.trim()),
    };
  })()`);
  record(
    'home marks nothing current, and a skip link comes first',
    chromeBits.current.length === 0 && chromeBits.skipFirst && chromeBits.main,
    `nav=[${chromeBits.links.join(', ')}]`,
  );

  await open('/tech/');
  const marked = await evaluate(`(() => {
    const current = Array.from(document.querySelectorAll('.nav__link[aria-current="page"]')).map((a) => a.textContent.trim());
    return { current };
  })()`);
  record(
    'the masthead marks the section you are in on an inner page',
    marked.current.length === 1 && marked.current[0] === 'Tech',
    `marked: [${marked.current.join(', ')}]`,
  );

  // Every repo link must point at the real GitHub profile.
  const repos = await evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('a[href*="github.com/justicethinker"]'));
    const bad = links.filter((a) => !a.href.startsWith('https://github.com/justicethinker'));
    return { total: links.length, bad: bad.length };
  })()`);
  record(
    'every repo link points at the real GitHub profile',
    repos.total >= 20 && repos.bad === 0,
    `${repos.total} github links, ${repos.bad} bad`,
  );

  /* ------------------------------------------- physics: content ↔ tank */
  await open('/physics/');

  // The tank is the page, and the content stands in it: the copy casts a real
  // shadow in the field, and hovering a block lifts that patch of water.
  const obstacles = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-wave-canvas]');
    const block = document.querySelector('[data-sends="boundary"]');
    // Sample the obstacle itself, inset enough to miss the bright rim the
    // field draws where it bends around the block.
    const obstacle = document.querySelector('[data-wave-obstacle]');
    if (!canvas || !block || !obstacle) return { found: false };

    const ctx = canvas.getContext('2d');
    const rect = obstacle.getBoundingClientRect();
    const scale = canvas.width / window.innerWidth;
    const inset = 10;
    const box = {
      x: Math.max(0, Math.round((rect.left + inset) * scale)),
      y: Math.max(0, Math.round((rect.top + inset) * scale)),
      w: Math.max(1, Math.round(Math.min(rect.width - inset * 2, 260) * scale)),
      h: Math.max(1, Math.round((rect.height - inset * 2) * scale)),
    };

    const mean = () => {
      const px = ctx.getImageData(box.x, box.y, box.w, box.h).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4 * 17) {
        sum += px[i];
        n++;
      }
      return sum / Math.max(1, n);
    };

    const whole = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let allSum = 0;
    let allN = 0;
    for (let i = 0; i < whole.length; i += 4 * 331) {
      allSum += whole[i];
      allN++;
    }

    const shadowed = mean();
    block.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    block.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    const nudged = mean();
    block.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));

    return {
      found: true,
      shadowed: Number(shadowed.toFixed(1)),
      openWater: Number((allSum / Math.max(1, allN)).toFixed(1)),
      nudged: Number(nudged.toFixed(1)),
      covers: canvas.getBoundingClientRect().width >= window.innerWidth - 2,
    };
  })()`);
  record(
    'the tank is the page, and blocks of copy cast a shadow in the water',
    obstacles.found && obstacles.covers && obstacles.shadowed < obstacles.openWater * 0.75,
    `inside a text block ${obstacles.shadowed} vs open water ${obstacles.openWater}`,
  );
  record(
    'hovering a block nudges the water around it',
    obstacles.found && obstacles.nudged > obstacles.shadowed + 4,
    `${obstacles.shadowed} → ${obstacles.nudged}`,
  );

  // Dragging must work anywhere on the page, not just inside an old box.
  const drag = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-wave-canvas]');
    if (!canvas) return { found: false };
    const before = JSON.parse(canvas.dataset.waveSources || '[]');
    if (!before.length) return { found: false };
    const rect = canvas.getBoundingClientRect();
    // The first emitter starts around 30% across; grab it well below the
    // masthead, in open page, and pull it somewhere new.
    const startX = rect.left + rect.width * before[0].x;
    const startY = rect.top + rect.height * before[0].y;
    const opts = (x, y) => ({
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 11,
      isPrimary: true,
      button: 0,
    });
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(startX, startY)));
    for (let k = 1; k <= 6; k++) {
      canvas.dispatchEvent(new PointerEvent('pointermove', opts(startX - k * 18, startY - k * 14)));
    }
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(startX - 108, startY - 84)));
    await new Promise((r) => setTimeout(r, 300));
    const after = JSON.parse(canvas.dataset.waveSources || '[]');
    return {
      found: true,
      moved: Math.abs(after[0].x - before[0].x) + Math.abs(after[0].y - before[0].y),
      inViewport: startY > rect.top && startY < rect.bottom,
    };
  })()`);
  record(
    'an emitter can be dragged anywhere in the page, not in a box',
    drag.found && drag.moved > 0.03,
    `emitter moved ${drag.moved.toFixed(3)} of the viewport`,
  );

  /* ------------------------------------------------------------ menu drawer */
  await open('/', 480);
  const drawer = await evaluate(`(async () => {
    const toggle = document.querySelector('[data-drawer-toggle]');
    const panel = document.querySelector('[data-drawer]');
    toggle.click();
    await new Promise((r) => setTimeout(r, 900));
    const opened = {
      open: panel.dataset.open,
      expanded: toggle.getAttribute('aria-expanded'),
      hidden: panel.hasAttribute('hidden'),
      focusInside: panel.contains(document.activeElement),
      locked: getComputedStyle(document.body).overflow === 'hidden',
    };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const closed = {
      open: panel.dataset.open,
      expanded: toggle.getAttribute('aria-expanded'),
      restored: getComputedStyle(document.body).overflow !== 'hidden',
    };
    return { opened, closed, links: panel.querySelectorAll('a[href]').length };
  })()`);
  record(
    'the menu opens on a phone, takes focus and locks the page behind it',
    drawer.opened.open === 'true' &&
      drawer.opened.expanded === 'true' &&
      drawer.opened.focusInside &&
      drawer.opened.locked,
    JSON.stringify(drawer.opened),
  );
  record(
    'Escape closes the menu and releases the page',
    drawer.closed.open === 'false' && drawer.closed.expanded === 'false' && drawer.closed.restored,
    JSON.stringify(drawer.closed),
  );

  /* ------------------------------------------------------------ wave lab */
  await open('/physics/');
  const lab = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-wave-stage] canvas');
    const freq = document.querySelector('[data-wave-freq]');
    const add = document.querySelector('[data-wave-add]');
    const reset = document.querySelector('[data-wave-reset]');
    const readout = document.querySelector('[data-wave-readout]');
    const before = readout ? readout.textContent : '';
    add?.click();
    await new Promise((r) => setTimeout(r, 300));
    const afterAdd = readout ? readout.textContent : '';
    const addDisabled = !!add?.disabled;
    reset?.click();
    await new Promise((r) => setTimeout(r, 300));
    const afterReset = readout ? readout.textContent : '';
    const rect = canvas ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      canvas: !!canvas,
      width: Math.round(rect.width),
      freq: !!freq,
      before,
      afterAdd,
      addDisabled,
      afterReset,
    };
  })()`);
  record(
    'the wave tank renders and its controls answer',
    lab.canvas && lab.width > 200 && lab.freq && lab.afterAdd.includes('3 sources'),
    `canvas=${lab.width}px wide, add→“${lab.afterAdd}”`,
  );
  record(
    'adding then resetting sources round-trips the simulation',
    lab.addDisabled && lab.afterReset.includes('2 sources') && lab.before.includes('2 sources'),
    `reset→“${lab.afterReset}”`,
  );

  // The tank must be drawing waves, not just holding a canvas: sample the
  // pixels the visitor actually sees.
  const tankPixels = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-wave-stage] canvas');
    if (!canvas) return { found: false };
    // The tank animates, so sample the brightest of several frames rather
    // than one arbitrary instant. A blank canvas scores ~0 on every frame.
    const ctx = canvas.getContext('2d');
    let best = 0;
    let sample = 0;
    for (let f = 0; f < 4; f++) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      sample = 0;
      for (let i = 0; i < px.length; i += 4 * 37) {
        sample++;
        if (px[i] > 60 || px[i + 1] > 60) bright++;
      }
      best = Math.max(best, bright / sample);
      await new Promise((r) => setTimeout(r, 350));
    }
    return {
      found: true,
      sampled: sample,
      brightPercent: Number((best * 100).toFixed(1)),
    };
  })()`);
  record(
    'the tank draws actual wave fronts, not a blank canvas',
    tankPixels.found && tankPixels.brightPercent > 8,
    `${tankPixels.brightPercent}% of sampled pixels carry a wave front`,
  );

  /* ------------------------------------------------- tech: solar system */
  await open('/tech/');
  const orbits = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-orbit-canvas]');
    const panel = document.querySelector('[data-orbit-panel]');
    // Drive it the keyboard way: the Next button selects the first world.
    document.querySelector('[data-orbit-next]')?.click();
    await new Promise((r) => setTimeout(r, 400));
    const name = document.querySelector('[data-orbit-name]')?.textContent || '';
    const link = document.querySelector('[data-orbit-link]')?.getAttribute('href') || '';
    return {
      live: canvas?.dataset.system === 'live',
      panelOpen: panel && !panel.hasAttribute('hidden'),
      name,
      github: link.startsWith('https://github.com/justicethinker/'),
    };
  })()`);
  record(
    'the solar system runs and landing on a world shows its repo',
    orbits.live && orbits.panelOpen && orbits.name.length > 2 && orbits.github,
    `landed on “${orbits.name}”`,
  );

  // The dive is driven by scroll progress now. It must zoom the system AND
  // leave the wheel alone, so the reader is never trapped in the scene.
  const dive = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-orbit-canvas]');
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 500));
    const beforeZoom = Number(canvas?.dataset.zoom || 1);

    // A wheel event on the scene must not be swallowed.
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 240 });
    const notPrevented = canvas.dispatchEvent(wheel);

    window.scrollTo({ top: 500, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 700));
    const afterZoom = Number(canvas?.dataset.zoom || 1);
    return { beforeZoom, afterZoom, notPrevented, scrolled: Math.round(window.scrollY) };
  })()`);
  record(
    'scrolling dives toward the sun instead of trapping the page',
    dive.notPrevented && dive.scrolled > 100 && dive.afterZoom > dive.beforeZoom,
    `zoom ${dive.beforeZoom}→${dive.afterZoom}, wheel swallowed: ${!dive.notPrevented}`,
  );

  /* ----------------------------------------------------- debate: scales */
  await open('/debate/');
  const scales = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-scale-canvas]');
    const readout = document.querySelector('[data-scale-readout]');
    const before = Number(canvas?.dataset.scaleFor || 0);
    document.querySelector('[data-scale-add-for]')?.click();
    await new Promise((r) => setTimeout(r, 900));
    const after = Number(canvas?.dataset.scaleFor || 0);
    return {
      live: canvas?.dataset.scale === 'live',
      frames: Number(canvas?.dataset.frames || 0),
      before,
      after,
      verdict: readout ? readout.textContent : '',
      tilt: Number(canvas?.dataset.tilt || 0),
      against: Number(canvas?.dataset.scaleAgainst || 0),
    };
  })()`);
  record(
    'the balance hangs, weighs a win, and reports the verdict',
    scales.live && scales.frames > 10 && scales.after === scales.before + 1,
    `for-side ${scales.before}→${scales.after} “${scales.verdict}”`,
  );
  // Tilt is signed so that a negative angle lowers the proposition (left) pan.
  // Whichever pan carries more weight must be the lower one.
  const settled = Math.abs(scales.tilt) > 0.02;
  const correct =
    scales.after > scales.against ? scales.tilt < 0 : scales.after < scales.against ? scales.tilt > 0 : true;
  record(
    'the heavier pan is the one that goes down',
    settled && correct,
    `proposition ${scales.after} vs opposition ${scales.against}, tilt ${scales.tilt}`,
  );

  // A result card dragged onto the left half must land on the proposition pan;
  // the arrow keys must do the same from the keyboard.
  const weigh = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-scale-canvas]');
    const card = document.querySelector('[data-weigh-index="0"]');
    if (!canvas || !card) return { found: false };
    const before = Number(canvas.dataset.scaleFor || 0);
    const rect = card.getBoundingClientRect();
    const opts = (x, y) => ({
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 21,
      isPrimary: true,
      button: 0,
    });
    const sx = rect.left + rect.width / 2;
    const sy = rect.top + rect.height / 2;
    card.dispatchEvent(new PointerEvent('pointerdown', opts(sx, sy)));
    card.dispatchEvent(new PointerEvent('pointermove', opts(sx - 120, sy - 40)));
    card.dispatchEvent(new PointerEvent('pointerup', opts(window.innerWidth * 0.2, sy - 60)));
    await new Promise((r) => setTimeout(r, 700));
    const afterDrag = Number(canvas.dataset.scaleFor || 0);

    card.focus();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    const afterKey = Number(canvas.dataset.scaleAgainst || 0);
    const against = Number(canvas.dataset.scaleAgainst || 0);
    const chip = document.querySelector('.weigh-chip');
    return {
      found: true,
      before,
      afterDrag,
      afterKey,
      against,
      chipLeftBehind: !!chip,
    };
  })()`);
  record(
    'dragging a result onto a pan adds it there',
    weigh.found && weigh.afterDrag === weigh.before + 1 && !weigh.chipLeftBehind,
    `proposition ${weigh.before}→${weigh.afterDrag}, chip left behind: ${weigh.chipLeftBehind}`,
  );
  record(
    'a focused result can be weighed with the arrow keys',
    weigh.found && weigh.afterKey >= 1,
    `opposition pan holds ${weigh.afterKey}`,
  );

  /* ------------------------------------------------- writing: titles */
  await open('/writing/');
  const titles = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-titles-canvas]');
    if (!canvas) return { found: false };
    // Brush through the interface a visitor uses, then count gold pixels.
    const rect = canvas.getBoundingClientRect();
    const opts = (x, y) => ({
      bubbles: true,
      clientX: rect.left + rect.width * x,
      clientY: rect.top + rect.height * y,
      pointerId: 7,
      isPrimary: true,
    });
    canvas.dispatchEvent(new PointerEvent('pointermove', opts(0.5, 0.55)));
    await new Promise((r) => setTimeout(r, 700));
    const ctx = canvas.getContext('2d');
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0;
    let sample = 0;
    for (let i = 0; i < px.length; i += 4 * 37) {
      sample++;
      if (px[i] > 70 || px[i + 1] > 60) bright++;
    }
    return {
      found: true,
      live: canvas.dataset.titles === 'live',
      brightPercent: Number(((bright / sample) * 100).toFixed(1)),
    };
  })()`);
  record(
    'the essay titles stand written in gold particles',
    titles.found && titles.live && titles.brightPercent > 1,
    `${titles.brightPercent}% of sampled pixels carry a title`,
  );

  // A title must be crisp at rest, break into dust around the pointer, and
  // re-form once the pointer leaves. Total ink is conserved by the scatter, so
  // a plain brightness count reads flat; the plate is a dimmer gold than the
  // dust it sheds, and the blue channel separates the two.
  const scatter = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-titles-canvas]');
    if (!canvas) return { found: false };
    const bands = JSON.parse(canvas.dataset.bands || '[]');
    if (!bands.length) return { found: false };
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / window.innerWidth;
    const read = (cx, cy, halfW, halfH) => {
      const x = Math.max(0, Math.round((cx - halfW) * scale));
      const y = Math.max(0, Math.round((cy - halfH) * scale));
      const w = Math.max(1, Math.round(halfW * 2 * scale));
      const h = Math.max(1, Math.round(halfH * 2 * scale));
      const px = ctx.getImageData(x, y, w, h).data;
      let plate = 0;
      let dust = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        n++;
        if (px[i + 2] > 118) dust++;
        else if (px[i] > 150 && px[i + 2] > 40) plate++;
      }
      return { plate: plate / n, dust: dust / n };
    };
    const band = bands[0];
    const atPointer = () => read(band.x, band.y, 60, 20);
    const inTheGap = () => read(band.x, band.y + 48, 200, 12);

    // Park nothing first: the previous check left the pointer on a title, and
    // "at rest" only means anything once that brush has settled.
    window.dispatchEvent(new PointerEvent('pointerleave'));
    await new Promise((r) => setTimeout(r, 1600));
    const rest = atPointer();
    const restGap = inTheGap();
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: band.x,
      clientY: band.y,
      pointerId: 31,
      isPrimary: true,
    }));
    await new Promise((r) => setTimeout(r, 700));
    const brushed = atPointer();
    const brushedGap = inTheGap();
    window.dispatchEvent(new PointerEvent('pointerleave'));
    await new Promise((r) => setTimeout(r, 1600));
    const settled = inTheGap();
    return {
      found: true,
      restPlate: Number(rest.plate.toFixed(3)),
      restDust: Number(rest.dust.toFixed(3)),
      restGap: Number(restGap.dust.toFixed(3)),
      brushedPlate: Number(brushed.plate.toFixed(3)),
      brushedDust: Number(brushed.dust.toFixed(3)),
      brushedGap: Number(brushedGap.dust.toFixed(3)),
      settledGap: Number(settled.dust.toFixed(3)),
      at: band.x + ',' + band.y,
      live: canvas.dataset.titles === 'live',
    };
  })()`);
  record(
    'a title is crisp at rest, scatters under the pointer, and re-forms',
    scatter.found &&
      scatter.live &&
      scatter.restDust <= 0.005 &&
      scatter.restGap <= 0.005 &&
      scatter.brushedDust > 0.01 &&
      scatter.brushedPlate < scatter.restPlate &&
      scatter.brushedGap > 0.04 &&
      scatter.settledGap <= 0.005,
    scatter.found
      ? `letters ${scatter.restPlate}→${scatter.brushedPlate}, dust at the pointer ${scatter.restDust}→${scatter.brushedDust}, dust flung into the gap ${scatter.restGap}→${scatter.brushedGap}→${scatter.settledGap} after the pointer left, live=${scatter.live}`
      : 'no title bands reported',
  );

  // Every title in the scene must also exist as a real, focusable link.
  const shelf = await evaluate(`(async () => {
    const links = Array.from(document.querySelectorAll('[data-title-links] a[href]'));
    const first = links[0];
    if (!first) return { found: false };
    first.focus();
    await new Promise((r) => setTimeout(r, 120));
    const panel = document.querySelector('[data-title-links]');
    const rect = panel.getBoundingClientRect();
    return {
      found: true,
      count: links.length,
      realLinks: links.every((a) => a.href.startsWith('https://justicethinker.substack.com/p/')),
      reachable: rect.width > 100 && rect.height > 40,
      focused: document.activeElement === first,
    };
  })()`);
  record(
    'the titles have keyboard reach and real links',
    shelf.found && shelf.count === 3 && shelf.realLinks && shelf.reachable && shelf.focused,
    `${shelf.count} links, panel visible on focus: ${shelf.reachable}`,
  );

  // Essays link out to the real Substack posts.
  await open('/writing/');
  const essays = await evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('a.essay[href*="justicethinker.substack.com/p/"]'));
    return { total: links.length };
  })()`);
  record(
    'the writing page links to the real Substack essays',
    essays.total === 3,
    `${essays.total} essay links`,
  );

  /* ------------------------------------- tech: the repo list ↔ the sky */
  await open('/tech/');

  // Walk the list with the keyboard the way a visitor does. Programmatic
  // element.focus() does not raise focus events in a headless target, so the
  // assertion rides on real Tab presses.
  const pressTab = async () => {
    const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    await new Promise((r) => setTimeout(r, 80));
  };
  const readFocus = () =>
    evaluate(`(() => {
      const canvas = document.querySelector('[data-orbit-canvas]');
      const el = document.activeElement;
      return {
        sends: (el && el.dataset && el.dataset.sends) || '',
        focus: canvas ? canvas.dataset.focus : '',
      };
    })()`);

  let reached = null;
  for (let i = 0; i < 40 && !reached; i++) {
    await pressTab();
    const now = await readFocus();
    if (!now.sends.startsWith('planet:')) continue;
    await new Promise((r) => setTimeout(r, 260));
    reached = { ...(await readFocus()), index: now.sends.split(':')[1] };
  }
  record(
    'tabbing into the repo list pulls that planet forward',
    !!reached && reached.focus === reached.index,
    reached
      ? `keyboard reached planet:${reached.index}, the scene reads “${reached.focus}”`
      : 'the list was never reached by Tab',
  );

  let left = null;
  for (let i = 0; i < 12 && !left; i++) {
    await pressTab();
    const now = await readFocus();
    if (now.sends.startsWith('planet:')) continue;
    await new Promise((r) => setTimeout(r, 260));
    left = await readFocus();
  }
  record(
    'leaving the list releases the planet',
    !!left && left.focus === '',
    left ? `next stop “${left.sends || 'past the list'}”, the scene reads “${left.focus}”` : 'focus never left the list',
  );

  /* ------------------------------------------- the calm and the cheap
     The quality bar asks for two things that are invisible in a screenshot:
     a phone-sized viewport must drop the scene to its low tier, and a reader
     who asked for reduced motion must get one calm frame, not a loop. */
  await open('/physics/', 390);
  const small = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-wave-canvas]');
    const before = Number(canvas.dataset.frames || 0);
    await new Promise((r) => setTimeout(r, 700));
    const after = Number(canvas.dataset.frames || 0);
    return {
      tier: canvas.dataset.waveTier,
      state: canvas.dataset.waveState,
      before,
      after,
      sources: JSON.parse(canvas.dataset.waveSources || '[]').length,
    };
  })()`);
  record(
    'a phone-sized viewport runs the scene on its low tier',
    small.tier === 'low' && small.after > small.before,
    `tier=${small.tier} state=${small.state}, ${small.sources} emitters, frames ${small.before}→${small.after}`,
  );

  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await open('/tech/');
  const calm = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-orbit-canvas]');
    const first = Number(canvas.dataset.frames || 0);
    await new Promise((r) => setTimeout(r, 900));
    const second = Number(canvas.dataset.frames || 0);
    const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 4 * 211) {
      n++;
      if (px[i] + px[i + 1] + px[i + 2] > 90) lit++;
    }
    return {
      state: canvas.dataset.orbitState,
      first,
      second,
      lit: Number(((lit / n) * 100).toFixed(1)),
    };
  })()`);
  record(
    'with motion reduced the scene paints one calm frame and holds it',
    calm.state === 'still' && calm.second === calm.first && calm.lit > 0.2,
    `state=${calm.state}, frames ${calm.first}→${calm.second}, ${calm.lit}% of the canvas carries the still`,
  );
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  /* ------------------------------------------------------ back to top */
  await open('/');
  const toTop = await evaluate(`(async () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 250));
    const mid = window.scrollY;
    const button = document.querySelector('[data-to-top]');
    button?.click();
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline && window.scrollY > 60) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { mid, exists: !!button, after: Math.round(window.scrollY) };
  })()`);
  record(
    'back to top returns the reader to the start of the page',
    toTop.exists && toTop.mid > 500 && toTop.after < 100,
    `${toTop.mid} → ${toTop.after}`,
  );
} catch (error) {
  record('harness', false, error.message);
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} interaction checks passed` +
    (failed.length ? ` — ${failed.length} failing` : ''),
);
process.exitCode = failed.length ? 1 : 0;
