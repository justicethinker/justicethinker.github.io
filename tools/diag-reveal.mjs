/**
 * Diagnose the reveal system.
 *
 * Loads a page and scrolls it with real animation-frame ticks between steps,
 * logging how many reveal targets have been lit at each scroll position. Then
 * reports any target that is still unlit, with its geometry, so a genuine
 * invisible-content bug can be told apart from a measurement artefact.
 *
 *   node tools/diag-reveal.mjs [path ...]
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

const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/speaking/', '/physics/'];

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
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const CDP_PORT = Number(process.env.DIAG_CDP_PORT || 9399);
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
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/diag-profile-${CDP_PORT}`,
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

/** Scroll the page with animation-frame ticks, logging lit counts. */
const SCROLL = `(async () => {
  const LIT = '[data-reveal].is-lit, [data-plate].is-lit';
  const ALL = '[data-reveal], [data-plate]';
  const total = document.querySelectorAll(ALL).length;
  const step = Math.round(window.innerHeight * 0.6);
  const end = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const trace = [];
  for (let y = 0; y <= end + step; y += step) {
    // html carries scroll-behavior: smooth, so a bare scrollTo animates and
    // the loop would sample positions it never actually reached.
    window.scrollTo({ top: Math.min(y, end), behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 70));
    trace.push({ y: Math.round(window.scrollY), lit: document.querySelectorAll(LIT).length });
  }
  return { total, trace };
})()`;

/** Sample document height and scroll behaviour over time, untouched. */
const TIMELINE = `(async () => {
  const samples = [];
  for (let i = 0; i < 10; i += 1) {
    samples.push({
      t: i * 400,
      h: document.documentElement.scrollHeight,
      y: Math.round(window.scrollY),
      imgs: Array.from(document.images).filter((i) => i.complete).length,
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  const html = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const tallest = Array.from(document.querySelectorAll('body *'))
    .map((el) => ({ sel: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0], r: el.getBoundingClientRect() }))
    .sort((a, b) => b.r.bottom - a.r.bottom)
    .slice(0, 3)
    .map((e) => e.sel + ' bottom' + Math.round(e.r.bottom));
  return {
    samples,
    scrollBehaviorHtml: html.scrollBehavior,
    scrollBehaviorBody: body.scrollBehavior,
    tallest,
    height: document.documentElement.scrollHeight,
  };
})()`;

/** Report every target that is still unlit, with geometry and why. */
const UNLIT = `(() => {
  const ALL = '[data-reveal], [data-plate]';
  const out = [];
  for (const el of document.querySelectorAll(ALL)) {
    if (el.classList.contains('is-lit')) continue;
    const r = el.getBoundingClientRect();
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.'),
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
      top: Math.round(r.top),
      h: Math.round(r.height),
      w: Math.round(r.width),
      opacity: getComputedStyle(el).opacity,
      inClosed: !!el.closest('details:not([open]), [hidden], template'),
    });
  }
  return { unlit: out.length, list: out.slice(0, 14), scrollY: Math.round(window.scrollY) };
})()`;

try {
  const wsUrl = await waitForPageTarget();
  const cdp = connect(wsUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const path of PAGES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
    await new Promise((r) => setTimeout(r, 1600));

    const timeline = await cdp.send('Runtime.evaluate', {
      expression: TIMELINE,
      returnByValue: true,
      awaitPromise: true,
    });
    const tl = timeline.result.value;
    console.log(`\n${path}   smooth: html=${tl.scrollBehaviorHtml} body=${tl.scrollBehaviorBody}`);
    console.log('  height/y ' + tl.samples.map((s) => `${s.t}:${s.h}/${s.y}/${s.imgs}i`).join('  '));
    console.log('  lowest ' + tl.tallest.join('  '));

    const scrolled = await cdp.send('Runtime.evaluate', {
      expression: SCROLL,
      returnByValue: true,
      awaitPromise: true,
    });
    const { total, trace } = scrolled.result.value;
    await new Promise((r) => setTimeout(r, 1200));

    const unlit = await cdp.send('Runtime.evaluate', {
      expression: UNLIT,
      returnByValue: true,
    });

    console.log(`\n${path}   targets ${total}`);
    console.log(
      '  trace ' + trace.map((t) => `${t.y}:${t.lit}`).join('  '),
    );
    const { unlit: count, list, scrollY } = unlit.result.value;
    console.log(`  unlit after pass: ${count}   (at scrollY ${scrollY})`);
    for (const item of list) {
      console.log(
        `   · ${item.tag}.${item.cls} h${item.h} w${item.w} top${item.top} op${item.opacity}` +
          `${item.inClosed ? ' [closed ancestor]' : ''} "${item.text}"`,
      );
    }
  }

  cdp.ws.close();
} catch (error) {
  console.error('diag failed:', error.message);
} finally {
  chrome.kill('SIGKILL');
  server.close();
}
