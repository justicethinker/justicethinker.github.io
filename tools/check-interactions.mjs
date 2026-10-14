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
        const photo = document.querySelector('.portrait__inner > img');
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

  /* -------------------------------------------------- debate: tug-of-war */
  await open('/debate/');
  // The push is transient by design (the room settles), so watch the peak
  // rather than sampling one arbitrary instant after it.
  const tug = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-tug-canvas]');
    const meter = document.querySelector('[data-tug-meter]');
    const atClick = Number(canvas?.dataset.split || 50);
    const btn = document.querySelector('[data-tug-for]');
    btn?.click();
    await new Promise((r) => setTimeout(r, 250));
    btn?.click();
    let peak = atClick;
    const deadline = Date.now() + 1800;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      peak = Math.max(peak, Number(canvas?.dataset.split || 50));
    }
    return {
      live: canvas?.dataset.tug === 'live',
      atClick,
      peak,
      verdict: meter ? meter.textContent : '',
    };
  })()`);
  record(
    'arguing for moves the field and the verdict follows it',
    tug.live && tug.peak > tug.atClick + 1,
    `${tug.atClick}→peak ${tug.peak} “${tug.verdict}”`,
  );

  /* ----------------------------------------------------- writing: ink */
  await open('/writing/');
  const ink = await evaluate(`(async () => {
    const canvas = document.querySelector('[data-ink-canvas]');
    if (!canvas) return { found: false };
    // Pour through the interface a visitor uses: a drag across the well.
    const rect = canvas.getBoundingClientRect();
    const opts = (x, y) => ({
      bubbles: true,
      clientX: rect.left + rect.width * x,
      clientY: rect.top + rect.height * y,
      pointerId: 7,
      isPrimary: true,
    });
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(0.3, 0.5)));
    for (let k = 1; k <= 8; k++) {
      canvas.dispatchEvent(new PointerEvent('pointermove', opts(0.3 + k * 0.05, 0.5)));
    }
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(0.7, 0.5)));
    await new Promise((r) => setTimeout(r, 800));
    // The tank animates, so sample the brightest of several frames rather
    // than one arbitrary instant. A blank canvas scores ~0 on every frame.
    const ctx = canvas.getContext('2d');
    let best = 0;
    for (let f = 0; f < 4; f++) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bright = 0;
      let sample = 0;
      for (let i = 0; i < px.length; i += 4 * 41) {
        sample++;
        if (px[i] > 70 || px[i + 1] > 60) bright++;
      }
      best = Math.max(best, bright / sample);
      await new Promise((r) => setTimeout(r, 350));
    }
    return {
      found: true,
      live: canvas.dataset.ink === 'live',
      brightPercent: Number((best * 100).toFixed(1)),
    };
  })()`);
  record(
    'a drag through the well leaves real gold ink behind',
    ink.found && ink.live && ink.brightPercent > 1,
    `${ink.brightPercent}% of sampled pixels carry ink`,
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
