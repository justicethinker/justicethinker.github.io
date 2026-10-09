/**
 * ffmpeg helpers.
 *
 * The only media the site ships is still imagery — one drawing, one social
 * card — so this module is deliberately small: it shells out to the
 * `ffmpeg-static` binary to transcode a rendered PNG into WebP or JPEG.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import ffmpegPath from 'ffmpeg-static';

export { ffmpegPath };

const QUIET = ['-hide_banner', '-loglevel', 'error', '-y'];

/** Convert a rendered PNG still into WebP or JPEG. */
export async function convertStill(pngPath, out, extraArgs) {
  const proc = spawn(ffmpegPath, [...QUIET, '-i', pngPath, ...extraArgs, out], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  proc.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const [code] = await once(proc, 'close');
  if (code !== 0) throw new Error(`ffmpeg still conversion failed (${code}): ${stderr.trim()}`);
}

export function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
