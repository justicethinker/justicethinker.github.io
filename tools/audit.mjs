/**
 * Audit the built site.
 *
 * Serves dist/ and drives the headless browser over the DevTools protocol to
 * check, on every page: console and page errors, failed requests, horizontal
 * overflow at four widths, whether every image and video actually loaded,
 * whether the self-hosted fonts resolved, whether any content is left
 * invisible by the reveal system, and the contrast of body copy.
 *
 *   node tools/audit.mjs [--port 8123]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const HERE = dirname(fileURLToPath(import.meta.url));

const CHROME = join(
  process.env.HOME || '/home/justicethinker',
  '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
);

const PAGES = [
  '/',
  '/physics/',
  '/programming/',
  '/speaking/',
  '/projects/',
  '/blog/',
  '/cv/',
  '/about/',
  '/contact/',
  '/404.html',
];

const WIDTHS = [1440, 1024, 768, 390];

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
  '.xml': 'application/xml',
};

/* ------------------------------------------------------------ static server */

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = normalize(decodeURIComponent(url.pathname));
    if (rel.endsWith('/')) rel += 'index.html';
    const file = join(dist, rel);
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(file);
    if (info.isDirectory()) {
      const body = await readFile(join(file, 'index.html'));
      res.writeHead(200, { 'Content-Type': TYPES['.html'] }).end(body);
      return;
    }
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

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;

/* ------------------------------------------------------------------- chrome */

const CDP_PORT = Number(process.env.AUDIT_CDP_PORT || 9388);
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
    '--force-color-profile=srgb',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/audit-profile-${CDP_PORT}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

let chromeErr = '';
chrome.stderr.on('data', (c) => {
  chromeErr += c.toString();
});

async function waitForPageTarget(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
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
  const handlers = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method) (handlers.get(msg.method) || []).forEach((fn) => fn(msg.params));
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP socket error')));
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
    on: (method, fn) => handlers.set(method, [...(handlers.get(method) || []), fn]),
    clear: () => handlers.clear(),
  };
}

/* -------------------------------------------------------------- page probes */

const PROBE = `(() => {
  const cs = getComputedStyle;
  const parse = (value) => {
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((n) => parseFloat(n));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const doc = document.documentElement;
  const overflow = doc.scrollWidth - window.innerWidth;

  const images = Array.from(document.images);
  const brokenImages = images.filter((img) => img.complete && img.naturalWidth === 0).map((i) => i.getAttribute('src'));
  const unloadedImages = images.filter((img) => !img.complete).length;

  const videos = Array.from(document.querySelectorAll('video'));
  const videoSources = videos.flatMap((v) => Array.from(v.querySelectorAll('source')).map((s) => s.getAttribute('src')));
  const videoPosters = videos.map((v) => v.getAttribute('poster')).filter(Boolean);

  // Body copy contrast: sample the first real paragraph.
  const para = document.querySelector('main p.prose, main p.lede, main p');
  let contrast = null;
  if (para) {
    const fg = parse(cs(para).color);
    let node = para, bg = null;
    while (node && !bg) {
      const c = parse(cs(node).backgroundColor);
      if (c && c.a > 0.5) bg = c;
      node = node.parentElement;
    }
    if (!bg) bg = { r: 4, g: 5, b: 10, a: 1 };
    if (fg) contrast = Math.round(ratio(fg, bg) * 100) / 100;
  }

  const revealTotal = document.querySelectorAll('[data-reveal], [data-plate]').length;
  const revealLit = document.querySelectorAll('[data-reveal].is-lit, [data-plate].is-lit').length;
  const stillHiddenList = Array.from(document.querySelectorAll('[data-reveal], [data-plate]'))
    .filter((el) => parseFloat(cs(el).opacity) < 0.9)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const hiddenAncestor = el.closest('details:not([open]), template, [hidden], [aria-hidden="true"]');
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.'),
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28),
        offscreen: r.width === 0 && r.height === 0,
        parentHidden: hiddenAncestor ? hiddenAncestor.tagName.toLowerCase() : '',
      };
    });
  const stillHidden = stillHiddenList.length;

  // Only the display face is shipped; body text uses the platform's own UI
  // sans, which cannot fail to resolve.
  const fonts = {
    display: document.fonts.check('16px "Instrument Serif"'),
    text: !!getComputedStyle(document.body).fontFamily,
  };

  const focusables = Array.from(
    document.querySelectorAll('a[href], button, input, select, textarea'),
  ).filter((el) => el.offsetParent !== null);
  const small = focusables
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.height < 24;
    })
    .map((el) =>
      el.tagName.toLowerCase() +
      '.' +
      (el.className || '').toString().split(' ')[0] +
      ' "' +
      (el.textContent || '').trim().slice(0, 20) +
      '"',
    );

  return {
    title: document.title,
    hasDescription: !!document.querySelector('meta[name="description"]')?.content,
    jsArmed: doc.classList.contains('js'),
    overflow,
    images: images.length,
    brokenImages,
    unloadedImages,
    videos: videos.length,
    videoSources,
    videoPosters,
    contrast,
    revealTotal,
    revealLit,
    stillHidden,
    stillHiddenList: stillHiddenList.slice(0, 12),
    stillHiddenReal: stillHiddenList.filter((e) => !e.offscreen && !e.parentHidden).length,
    fonts,
    h1Count: document.querySelectorAll('h1').length,
    headings: document.querySelectorAll('h1,h2,h3,h4').length,
    imgAltMissing: images.filter((i) => !i.alt).length,
    ariaCurrent: document.querySelectorAll('[aria-current="page"]').length,
    smallTargets: small.length,
    smallTargetList: [...new Set(small)].slice(0, 6),
    mainPresent: !!document.querySelector('main#main'),
  };
})()`;

/** Scroll the whole page so lazy media loads and every reveal fires. */
const SCROLL_PASS = `(async () => {
  const step = Math.round(window.innerHeight * 0.6);
  const end = document.documentElement.scrollHeight - window.innerHeight;
  // html carries scroll-behavior: smooth, so a bare scrollTo animates and the
  // pass would only sample a handful of positions. Step instantly instead, and
  // give the observer a real frame at each stop.
  const jump = (top) => window.scrollTo({ top, behavior: 'instant' });
  for (let y = 0; y < end; y += step) {
    jump(y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 60));
  }
  jump(end);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 400));
  jump(0);
  await new Promise((r) => setTimeout(r, 250));
  return true;
})()`;

/** Reveals run 900ms plus up to ~300ms of stagger, so a fixed wait samples
    them mid-rise and reports lit content as invisible. Wait for the finite
    animations to finish. Any looping animation would never end and is
    excluded. Returns how many finite animations are still running. */
const SETTLE_PASS = `(async () => {
  const finite = (a) => {
    const timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    return timing.iterations !== Infinity;
  };
  const pending = () =>
    document.getAnimations().filter((a) => a.playState === 'running' && finite(a)).length;
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && pending() > 0) {
    await new Promise((r) => setTimeout(r, 120));
  }
  return pending();
})()`;

/* --------------------------------------------------------------------- main */

const findings = [];
const rows = [];

try {
  const wsUrl = await waitForPageTarget();
  const cdp = connect(wsUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');

  let consoleErrors = [];
  let pageErrors = [];
  let failedRequests = [];
  cdp.clear();
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  cdp.on('Runtime.exceptionThrown', (p) =>
    pageErrors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text),
  );
  cdp.on('Network.loadingFailed', (p) => {
    if (!p.canceled) failedRequests.push(`${p.type} ${p.errorText}`);
  });
  cdp.on('Network.responseReceived', (p) => {
    if (p.response.status >= 400) failedRequests.push(`${p.response.status} ${p.response.url}`);
  });

  for (const path of PAGES) {
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];

    const url = `http://127.0.0.1:${PORT}${path}`;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTHS[0],
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1500));

    // Scroll the full document first: lazy media start loading and the reveal
    // system fires, so the probe measures the settled state rather than the
    // above-the-fold state.
    await cdp.send('Runtime.evaluate', {
      expression: SCROLL_PASS,
      returnByValue: true,
      awaitPromise: true,
    });
    await new Promise((r) => setTimeout(r, 600));

    const settle = await cdp.send('Runtime.evaluate', {
      expression: SETTLE_PASS,
      returnByValue: true,
      awaitPromise: true,
    });
    const stillAnimating = settle.result.value || 0;
    await new Promise((r) => setTimeout(r, 250));

    const probe = await cdp.send('Runtime.evaluate', {
      expression: PROBE,
      returnByValue: true,
      awaitPromise: false,
    });
    const result = probe.result.value || {};

    // Width sweep for horizontal overflow.
    const overflowAt = {};
    for (const width of WIDTHS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await new Promise((r) => setTimeout(r, 320));
      const check = await cdp.send('Runtime.evaluate', {
        expression: 'document.documentElement.scrollWidth - window.innerWidth',
        returnByValue: true,
      });
      overflowAt[width] = Math.max(0, check.result.value || 0);
    }

    rows.push({ path, ...result, stillAnimating, overflowAt });

    const problems = [];
    if (consoleErrors.length) problems.push(`console: ${consoleErrors.slice(0, 2).join(' | ')}`);
    if (pageErrors.length) problems.push(`pageerror: ${pageErrors.slice(0, 2).join(' | ')}`);
    if (failedRequests.length) problems.push(`requests: ${[...new Set(failedRequests)].slice(0, 4).join(' | ')}`);
    for (const [width, amount] of Object.entries(overflowAt)) {
      if (amount > 1) problems.push(`overflow ${amount}px @${width}`);
    }
    if (result.brokenImages?.length) problems.push(`broken images: ${result.brokenImages.join(', ')}`);
    if (result.unloadedImages) problems.push(`${result.unloadedImages} images never loaded`);
    if (stillAnimating) problems.push(`${stillAnimating} finite animations still running at measure time`);
    if (result.stillHiddenReal) {
      problems.push(`${result.stillHiddenReal} visible elements still transparent`);
      for (const e of result.stillHiddenList.filter((x) => !x.offscreen && !x.parentHidden)) {
        problems.push(`   ◂ ${e.tag}.${e.cls} "${e.text}"`);
      }
    }
    if (result.contrast !== null && result.contrast !== undefined && result.contrast < 4.5) {
      problems.push(`body contrast ${result.contrast}:1`);
    }
    if (result.h1Count !== 1) problems.push(`${result.h1Count} h1 elements`);
    if (!result.mainPresent) problems.push('no main landmark');
    if (!result.jsArmed) problems.push('js flag missing');
    if (!result.fonts?.display || !result.fonts?.text) {
      problems.push(`fonts: ${JSON.stringify(result.fonts)}`);
    }
    if (result.imgAltMissing) problems.push(`${result.imgAltMissing} images without alt`);
    if (!result.videoPosters?.length && result.videos) problems.push('video without poster');
    if (result.smallTargets) {
      problems.push(`${result.smallTargets} targets under 24px: ${(result.smallTargetList || []).join(' ; ')}`);
    }

    if (problems.length) findings.push({ path, problems });
  }

  cdp.ws.close();
} catch (error) {
  findings.push({ path: '(harness)', problems: [error.message] });
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

/* ------------------------------------------------------------------- report */

console.log('\nPAGE AUDIT');
console.log('─'.repeat(96));
console.log(
  'page'.padEnd(16) +
    'overflow'.padEnd(22) +
    'reveal'.padEnd(14) +
    'contrast'.padEnd(11) +
    'imgs'.padEnd(7) +
    'vids'.padEnd(6) +
    'focus'.padEnd(7) +
    'head',
);
console.log('─'.repeat(96));

for (const row of rows) {
  const overflow = Object.entries(row.overflowAt || {})
    .map(([w, a]) => `${w}:${a > 1 ? `+${a}` : 'ok'}`)
    .join(' ');
  console.log(
    row.path.padEnd(16) +
      overflow.padEnd(22) +
      `${row.revealLit}/${row.revealTotal}${row.stillHiddenReal ? ` !${row.stillHiddenReal}` : ''}`.padEnd(14) +
      `${row.contrast ?? '-'}`.padEnd(11) +
      `${row.images}`.padEnd(7) +
      `${row.videos ?? 0}`.padEnd(6) +
      `${row.smallTargets ?? 0}`.padEnd(7) +
      `${row.headings}`,
  );
}

console.log('─'.repeat(96));

if (findings.length === 0) {
  console.log('\nAll pages clean: no console errors, no failed requests, no overflow,');
  console.log('no broken images, no hidden content, contrast at or above 4.5:1.');
} else {
  console.log('\nFINDINGS\n');
  for (const finding of findings) {
    console.log(`${finding.path}`);
    for (const problem of finding.problems) console.log(`   · ${problem}`);
  }
}

// The report is the point of the run, so a finding must fail the command it
// is chained into rather than only failing on screen.
process.exitCode = findings.length ? 1 : 0;

process.exit(findings.length === 0 ? 0 : 1);
