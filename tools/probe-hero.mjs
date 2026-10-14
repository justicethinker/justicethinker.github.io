/**
 * Does the hero field actually draw?
 *
 * A canvas element can exist while the renderer never initialised — no WebGL,
 * CDN unreachable, or a script error. Reading pixels back from the canvas
 * itself is unreliable (WebGL clears the drawing buffer after compositing), so
 * this measures the rendered page: it screenshots the hero region through the
 * DevTools protocol and counts bright pixels in that image with ffmpeg.
 *
 * A hero whose field failed scores ~0% bright pixels against the flat gradient.
 *
 *   node tools/probe-hero.mjs [--width 1440] [--json]
 */

import { createServer } from 'node:http';
import { readFile, stat, writeFile, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const CHROME = join(
  process.env.HOME || '/home/justicethinker',
  '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
const width = flag('width', 1440);
const height = 600;

const FFMPEG = (() => {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
})();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
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
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const CDP = Number(process.env.PROBE_CDP_PORT || 9455);
// Same flags the screenshot tool uses — the combination already known to
// rasterise the field here.
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
    `--remote-debugging-port=${CDP}`,
    `--user-data-dir=/tmp/probe-profile-${CDP}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let chromeErr = '';
chrome.stderr.on('data', (c) => (chromeErr += c.toString()));

async function target() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP}/json/list`);
      if (res.ok) {
        const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no CDP target\n${chromeErr.slice(-400)}`);
}

const ws = new WebSocket(await target());
await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', () => rej(new Error('ws open failed')));
});

let id = 1;
const pending = new Map();
const pageErrors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    pageErrors.push(m.params.args.map((a) => a.value).join(' '));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

// The system temp directory, not the workspace: this must not depend on a
// scratch folder existing, and it must not leave anything behind.
const shotPath = join(tmpdir(), `hero-probe-${process.pid}.png`);
let exitCode = 1;

try {
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await new Promise((r) => setTimeout(r, 6000));

  const dom = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('[data-hero-field]');
      const r = c ? c.getBoundingClientRect() : null;
      const gl = c ? (c.getContext('webgl2') || c.getContext('webgl')) : null;
      return {
        hasCanvas: !!c,
        cssHeight: r ? Math.round(r.height) : 0,
        hasGl: !!gl,
        lost: gl ? gl.isContextLost() : null,
        imported: !!document.querySelector('script[type="importmap"]'),
      };
    })()`,
    returnByValue: true,
  });

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  await writeFile(shotPath, Buffer.from(shot.data, 'base64'));

  if (!FFMPEG) throw new Error('ffmpeg-static is not installed');
  const gray = execFileSync(
    FFMPEG,
    ['-v', 'error', '-i', shotPath, '-vf', 'format=gray', '-f', 'rawvideo', '-'],
    { maxBuffer: 1 << 28, encoding: 'buffer' },
  );

  let lit = 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    if (gray[i] > 100) lit++;
  }
  const mean = sum / gray.length;
  const litPercent = (lit / gray.length) * 100;

  const report = {
    ...dom.result.value,
    canvasPixels: gray.length,
    litPixels: lit,
    litPercent: Number(litPercent.toFixed(3)),
    meanLuminance: Number(mean.toFixed(1)),
    // Empty field: no bright pixels and a nearly black mean.
    drawing: lit > 200 && mean > 3,
    pageErrors: pageErrors.slice(0, 4),
  };

  console.log(JSON.stringify(report, null, 2));
  exitCode = report.drawing && report.hasGl && !report.lost ? 0 : 1;
} catch (error) {
  console.error(`probe failed: ${error.message}`);
  exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
  server.close();
  await rm(shotPath, { force: true });
}

process.exit(exitCode);
