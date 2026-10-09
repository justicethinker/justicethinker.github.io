/**
 * Screenshot tool.
 *
 * Drives the cached Playwright Chromium over the DevTools protocol so pages
 * can be captured full-length at any viewport. Motion is emulated as
 * "reduced" by default, which makes the site resolve every reveal to its
 * final state — so a screenshot shows the settled composition rather than
 * whatever happened to be above the fold.
 *
 *   node tools/shoot.mjs <url> <out.png> [--width 1440] [--height 900]
 *                        [--full] [--scale 1] [--motion] [--wait 1600]
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = join(
  process.env.HOME || '/home/justicethinker',
  '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
);

const PORT = Number(process.env.SHOOT_PORT || 9377);

/* ------------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const url = positional[0];
const out = positional[1];
if (!url || !out) {
  console.error('usage: node tools/shoot.mjs <url> <out.png> [--width N] [--height N] [--full] [--motion]');
  process.exit(64);
}

const width = Number(flag('width', 1440));
const height = Number(flag('height', 900));
const scale = Number(flag('scale', 1));
const full = has('full');
const settle = Number(flag('wait', 1800));
const emulateReducedMotion = !has('motion');

/* ----------------------------------------------------------------- browser */

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
    '--disable-extensions',
    '--force-color-profile=srgb',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/shoot-profile-${PORT}`,
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
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
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
  throw new Error(`No CDP page target on ${PORT}.\n${chromeErr.slice(-800)}`);
}

/* -------------------------------------------------------------- CDP client */

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      const handlers = listeners.get(msg.method);
      if (handlers) handlers.forEach((fn) => fn(msg.params));
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP socket error')));
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const once = (method) =>
    new Promise((resolve) => {
      const fn = (params) => {
        const handlers = listeners.get(method) || [];
        listeners.set(method, handlers.filter((h) => h !== fn));
        resolve(params);
      };
      listeners.set(method, [...(listeners.get(method) || []), fn]);
    });

  return { ws, ready, send, once };
}

/* -------------------------------------------------------------------- main */

let failed = null;

try {
  const webSocketDebuggerUrl = await waitForPageTarget();

  const { ws, ready, send, once } = connect(webSocketDebuggerUrl);
  await ready;

  await send('Page.enable');
  await send('Network.enable').catch(() => {});
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
  });
  await send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: emulateReducedMotion
      ? [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      : [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
  await new Promise((r) => setTimeout(r, settle));

  if (full) {
    const metrics = await send('Page.getLayoutMetrics');
    const content = metrics.cssContentSize || metrics.contentSize;
    const total = Math.min(Math.ceil(content.height), 30000);
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: total,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
    optimizeForSpeed: false,
  });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(shot.data, 'base64'));
  console.log(`${out}  ${width}x${full ? 'full' : height}  scale ${scale}`);
  ws.close();
} catch (error) {
  failed = error;
} finally {
  chrome.kill('SIGKILL');
}

if (failed) {
  console.error(`screenshot failed: ${failed.message}`);
  process.exit(1);
}

// A browser child or an open socket can keep the loop alive after the work is
// done; the file is already on disk, so leave deterministically.
process.exit(0);
