/**
 * Make screenshots readable.
 *
 * Full-page captures are far too large to attach to a conversation, so this
 * writes two useful forms of each shot into .tmp/preview/: a scaled overview of
 * the whole page, and equal slices at near-native width so type and spacing can
 * actually be judged. Uses the ffmpeg binary that ffmpeg-static already
 * installed for image conversion.
 *
 *   node tools/preview-shots.mjs [file.png ...] [--width 900] [--slice 1800]
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

const FFMPEG = (() => {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
})();

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
const targetWidth = flag('width', 900);
const sliceHeight = flag('slice', 1800);
const quality = String(flag('q', 5));

const inputs = argv.filter((a) => !a.startsWith('--') && a.toLowerCase().endsWith('.png'));
if (!inputs.length) {
  const entries = await readdir(join(root, '.tmp/shots'));
  for (const name of entries) {
    if (extname(name) === '.png') inputs.push(join(root, '.tmp/shots', name));
  }
}
if (!FFMPEG) {
  console.error('ffmpeg-static is not installed; run npm install first.');
  process.exit(1);
}

/** PNG dimensions live in the IHDR chunk, bytes 16..24, big-endian. */
async function pngSize(file) {
  const head = Buffer.alloc(26);
  const handle = await (await import('node:fs/promises')).open(file, 'r');
  await handle.read(head, 0, 26, 0);
  await handle.close();
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const outDir = join(root, '.tmp/preview');
await mkdir(outDir, { recursive: true });

for (const file of inputs) {
  const name = basename(file, '.png');
  const { width, height } = await pngSize(file);

  // Whole page, scaled down far enough to be one glance.
  const overview = join(outDir, `${name}-overview.jpg`);
  await run(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', file,
    '-vf', `scale=${targetWidth}:-1:flags=area`,
    '-q:v', quality,
    overview,
  ]);

  // Slices at readable scale, walking down the page.
  const slices = Math.max(1, Math.ceil(height / sliceHeight));
  for (let i = 0; i < slices; i += 1) {
    const y = i * sliceHeight;
    const h = Math.min(sliceHeight, height - y);
    if (h < 40) continue;
    const out = join(outDir, `${name}-s${String(i + 1).padStart(2, '0')}.jpg`);
    await run(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-i', file,
      '-vf', `crop=${width}:${h}:0:${y},scale=${targetWidth}:-1:flags=lanczos`,
      '-q:v', quality,
      out,
    ]);
  }

  const sizes = [];
  for (const out of [overview, join(outDir, `${name}-s01.jpg`)]) {
    try {
      const info = await stat(out);
      sizes.push(`${basename(out)} ${Math.round(info.size / 1024)}kB`);
    } catch {
      /* slice may be empty */
    }
  }
  console.log(`${name}  ${width}x${height}  ${slices} slices  ${sizes.join('  ')}`);
}
