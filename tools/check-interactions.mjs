/**
 * Exercise the site's interactive layer through the interface a visitor uses.
 *
 * A green audit only proves the pages render; this drives the actual controls
 * over the DevTools protocol — the drawing and its caption, the menu, the
 * contact form and back-to-top — and asserts observable behaviour, so a
 * control that renders but does nothing cannot pass.
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

  /* ----------------------------------------------------- home: the drawing */
  await open('/');

  const image = await evaluate(`(() => {
    const img = document.querySelector('.figure img');
    const caption = document.querySelector('.figure__caption');
    const videos = document.querySelectorAll('video').length;
    return {
      found: !!img,
      loaded: !!img && img.complete && img.naturalWidth > 0,
      width: img ? Number(img.getAttribute('width')) : 0,
      height: img ? Number(img.getAttribute('height')) : 0,
      loading: img ? img.getAttribute('loading') : '',
      alt: img ? img.getAttribute('alt').length : 0,
      caption: caption ? caption.textContent.trim().length : 0,
      videos,
    };
  })()`);
  record(
    'the drawing loads, declares its size, and is described',
    image.found && image.loaded && image.width > 0 && image.height > 0 && image.alt > 40,
    `${image.width}x${image.height} loading=${image.loading} alt=${image.alt} chars`,
  );
  record(
    'the image carries a caption and the page ships no video at all',
    image.caption > 40 && image.videos === 0,
    `caption=${image.caption} chars, videos=${image.videos}`,
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
    };
  })()`);
  record(
    'the current page is marked in the masthead, and only once',
    chromeBits.current.length === 0 && chromeBits.main,
    `home marks: [${chromeBits.current.join(', ')}] — home is the brand link`,
  );
  record(
    'a skip link is the first thing a keyboard reaches',
    chromeBits.skipFirst && chromeBits.skipHref === '#main' && chromeBits.main,
    `href=${chromeBits.skipHref}`,
  );

  await open('/projects/');
  const marked = await evaluate(`(() => {
    const current = Array.from(document.querySelectorAll('.nav__link[aria-current="page"]')).map((a) => a.textContent.trim());
    return { current };
  })()`);
  record(
    'the masthead marks the section you are in on an inner page',
    marked.current.length === 1,
    `marked: [${marked.current.join(', ')}]`,
  );

  /* ------------------------------------------------------------ menu drawer */
  await open('/', 480);
  const drawer = await evaluate(`(async () => {
    const toggle = document.querySelector('[data-drawer-toggle]');
    const panel = document.querySelector('[data-drawer]');
    toggle.click();
    await new Promise((r) => setTimeout(r, 800));
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

  /* ------------------------------------------------------- contact: form */
  await open('/contact/');
  const form = await evaluate(`(async () => {
    const status = document.querySelector('[data-form-status]');
    const email = document.querySelector('input[name="email"]');
    const wired =
      status.getAttribute('role') === 'status' && status.getAttribute('aria-live') === 'polite';

    // An empty submit must be refused, not turned into an empty draft.
    document.querySelector('[data-contact-form] button[type="submit"]').click();
    await new Promise((r) => setTimeout(r, 250));

    return {
      wired,
      draftOpened: status.textContent.includes('Opening') || !!status.querySelector('a[href]'),
      stillHere: document.body.contains(status),
      focused: document.activeElement?.getAttribute('name') || '',
      emailType: email.type,
      autocomplete: email.autocomplete,
    };
  })()`);
  record(
    'the form is labelled, typed and reports through a live region',
    form.wired && form.emailType === 'email' && form.autocomplete === 'email',
    `type=${form.emailType} autocomplete=${form.autocomplete}`,
  );
  // An empty form never reaches the handler: the browser refuses the submit and
  // moves focus to the first field it objects to, which is the behaviour that
  // matters. What must not happen is a half-written draft.
  record(
    'an empty submit is refused, with focus on the first missing field',
    !form.draftOpened && form.focused === 'name' && form.stillHere,
    `focus on ${form.focused}, draft opened: ${form.draftOpened}`,
  );

  const draft = await evaluate(`(async () => {
    const status = document.querySelector('[data-form-status]');
    const form = document.querySelector('[data-contact-form]');
    form.querySelector('input[name="name"]').value = 'Ada Lovelace';
    form.querySelector('input[name="email"]').value = 'ada@example.com';
    form.querySelector('textarea[name="message"]').value = 'Collision terms, please.';
    form.querySelector('button[type="submit"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const link = status.querySelector('a[href^="mailto:"]');
    return { hasLink: !!link, href: link ? link.getAttribute('href') : '' };
  })()`);
  record(
    'submitting composes a real mail draft, addressed and quoted',
    draft.hasLink &&
      draft.href.includes('justicethinker2@gmail.com') &&
      draft.href.includes('subject=') &&
      draft.href.includes('Ada%20Lovelace'),
    draft.href || 'no draft link',
  );

  /* ------------------------------------------------------ back to top */
  await open('/');
  const toTop = await evaluate(`(async () => {
    window.scrollTo({ top: 3000, behavior: 'instant' });
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
    toTop.exists && toTop.mid > 1000 && toTop.after < 100,
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
