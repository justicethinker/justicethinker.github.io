/**
 * Compose the social card.
 *
 * The card is real HTML and CSS rendered by a browser, using the site's own
 * self-hosted fonts — so the social preview is typographically identical to
 * the site rather than approximated by an image library.
 *
 * A throwaway static server is started on a free port so fonts and plate
 * imagery resolve with normal HTTP semantics. The screenshot runs in a child
 * process and must therefore be spawned asynchronously: a synchronous spawn
 * would block this process's event loop and the server could never answer.
 */

import { createServer } from 'node:http';
import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import { convertStill, human } from './encode.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.tmp');
const out = join(root, 'public', 'og.jpg');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
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
const port = server.address().port;

await mkdir(tmp, { recursive: true });
const png = join(tmp, 'og-card.png');

try {
  console.log(`serving the workspace on 127.0.0.1:${port}`);

  const child = spawn(
    process.execPath,
    [
      join(root, 'tools', 'shoot.mjs'),
      `http://127.0.0.1:${port}/tools/og-card.html`,
      png,
      '--width',
      '1200',
      '--height',
      '630',
      '--wait',
      '2600',
      '--motion',
    ],
    { cwd: root, stdio: 'inherit' },
  );

  const [code] = await once(child, 'close');
  if (code !== 0) throw new Error(`shoot.mjs exited ${code}`);

  await convertStill(png, out, ['-q:v', '3']);
  console.log(`og.jpg  ${human((await stat(out)).size)}`);
} finally {
  server.close();
  await rm(png, { force: true });
}
