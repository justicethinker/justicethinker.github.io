/**
 * Generate the one image this site uses.
 *
 * A still rather than a loop, deliberately. The same drawing animated cost
 * between two and nine megabytes depending on raster and quality — for a
 * drifting line field that a visitor watches for two seconds. A 1600-pixel
 * still carries the same idea for about a hundred kilobytes, so the site has
 * no autoplaying media at all.
 *
 *   node tools/gen-image.mjs
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderInk } from './ink.mjs';
import { encodePng } from './png.mjs';
import { convertStill, human } from './encode.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = join(root, 'public', 'art');
const tmpDir = join(root, '.tmp', 'image');

/* Fewer, heavier lines: calmer to look at, and far kinder to a webp encoder
   than a dense field of one-pixel contours. */
const STILL = {
  file: 'ink',
  width: 1600,
  height: 1000,
  options: { lines: 2.2, weight: 2.1, strength: 1, grain: 0.5 },
};

await mkdir(artDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

const started = Date.now();
const buf = renderInk(STILL.width, STILL.height, 0, STILL.options);
const png = join(tmpDir, `${STILL.file}.png`);
await writeFile(png, encodePng(STILL.width, STILL.height, buf));

const out = join(artDir, `${STILL.file}.webp`);
await convertStill(png, out, ['-c:v', 'libwebp', '-quality', '74', '-compression_level', '6']);

console.log(
  `${out}  ${STILL.width}x${STILL.height}  ${human((await stat(out)).size)}  ${Date.now() - started}ms`,
);
