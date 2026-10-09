/**
 * Ink on paper.
 *
 * The interference field drawn as line work instead of light: a few emitters
 * summed into one scalar field, and the ink sits on the contours of that sum.
 * Where the field changes slowly the lines open out; where it turns quickly
 * they crowd together, which is how a hand-drawn wave figure behaves too.
 *
 * Monochrome by construction — the site's one accent is never spent on
 * decoration.
 *
 * The hot loop is written the way a renderer wants it: flat typed arrays, a
 * cosine table, and one field evaluation per pixel — the contour gradient is
 * carried over from the neighbouring pixel rather than sampled again.
 */

const TAU = Math.PI * 2;

/* Paper and ink. Warm, low contrast: no pure white and no pure black. */
/* Exactly the site's --paper token. A point of difference is invisible until the
   sheet sits on the page, where it becomes a visible rectangle. */
const PAPER = [247, 245, 241];
const INK = [26, 23, 21];

const LUT_BITS = 12;
const LUT_SIZE = 1 << LUT_BITS;
const LUT_MASK = LUT_SIZE - 1;
const SCALE = LUT_SIZE / TAU;

const COS = new Float64Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i += 1) COS[i] = Math.cos((i / LUT_SIZE) * TAU);

/* Phase is wrapped by two's-complement masking, which is exact because the
   table size is a power of two. Error is under 2π/4096 — invisible in line art. */
const fastCos = (x) => COS[(Math.floor(x * SCALE) >>> 0) & LUT_MASK];

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sources on a ring, each carrying a whole number of cycles, so the field is
 * bounded and the drawing returns to its starting phase.
 */
/* Three sources at 120°, not five. Five produced a dense cell pattern —
   interference for its own sake. Three gives the field room to breathe and
   leaves curves long enough to follow with the eye. */
const CYCLES = [1, 1, 2];
const COUNT = CYCLES.length;

function buildSources(width, height, t, loop) {
  const short = Math.min(width, height);
  const ring = short * 0.3;
  const cx = width / 2;
  const cy = height / 2;
  const spin = (TAU * (t / loop)) * 0.12;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);

  const sx = new Float64Array(COUNT);
  const sy = new Float64Array(COUNT);
  const sk = new Float64Array(COUNT);
  const sr = new Float64Array(COUNT);
  const sp = new Float64Array(COUNT);

  for (let i = 0; i < COUNT; i += 1) {
    const angle = (TAU * i) / COUNT - Math.PI / 2;
    const jitter = 0.85 + 0.3 * (Math.sin((i + 1) * 12.9898) * 43758.5453 % 1);
    const ox = Math.cos(angle) * ring * jitter;
    const oy = Math.sin(angle) * ring * jitter;
    sx[i] = cx + ox * cos - oy * sin;
    sy[i] = cy + ox * sin + oy * cos;
    // Long wavelengths: the field should read as a few dozen curves across the
    // sheet, not as a woven texture. Three to five cycles over the frame.
    sk[i] = (TAU * (3 + i)) / (short * 1.06);
    sr[i] = short * 0.62;
    sp[i] = CYCLES[i] * TAU * (t / loop) + i * 0.7;
  }

  return { sx, sy, sk, sr, sp };
}

/**
 * Render one frame as an rgb buffer.
 *
 *   width, height   pixels
 *   t               seconds into the loop
 *   options.loop    loop length in seconds
 *   options.lines   contour density
 *   options.weight  line weight in pixels
 */
export function renderInk(width, height, t = 0, options = {}) {
  const {
    loop = 6,
    lines = 9,
    weight = 1.8,
    seed = 5,
    grain = 0.8,
    strength = 0.92,
  } = options;

  const out = new Uint8Array(width * height * 3);
  const { sx, sy, sk, sr, sp } = buildSources(width, height, t, loop);
  const rand = mulberry32(seed);

  const cx = width / 2;
  const cy = height / 2;
  const halfDiag = Math.sqrt(cx * cx + cy * cy);

  // The radial dissolve is the same every frame: build it once per call.
  const mask = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    const dx = (x - cx) / halfDiag;
    mask[x] = dx;
  }

  for (let y = 0; y < height; y += 1) {
    const dyEdge = (y - cy) / halfDiag;
    let previous = 0;
    let first = true;

    for (let x = 0; x < width; x += 1) {
      const dx = mask[x];
      const radial = Math.sqrt(dx * dx + dyEdge * dyEdge);
      const dissolve = smoothstep(1.0, 0.6, radial);

      let sum = 0;
      for (let i = 0; i < COUNT; i += 1) {
        const dxx = x - sx[i];
        const dyy = y - sy[i];
        const dist = Math.sqrt(dxx * dxx + dyy * dyy);
        const u = dist / sr[i];
        sum += fastCos(sk[i] * dist - sp[i]) * (1 / (1 + u * u));
      }

      // Gradient carried over from the previous pixel: one field sample per
      // pixel instead of two. Row starts have no neighbour, so nothing is drawn
      // in that one column — it is sub-pixel work either way.
      const grad = first ? 0 : Math.abs(sum - previous);
      first = false;
      previous = sum;

      const band = Math.abs(sum * lines - Math.floor(sum * lines) - 0.5);
      // Capped as well as floored: without the ceiling, strokes merge wherever
      // the field turns sharply and the drawing collapses into black blotches.
      // A real contour map thins out there instead of filling in.
      const half = Math.min(Math.max((weight / 2) * grad * lines, 1e-4), 0.22);
      let cover = 1 - smoothstep(0, half, band);

      // Sharpen the line profile. A soft gradient across every stroke turns the
      // whole sheet into intermediate grey, which is expensive to encode and
      // reads as a wash instead of as ink. This keeps one pixel of edge on each
      // side and commits the rest to paper or ink.
      cover = smoothstep(0.45, 0.82, cover);
      cover *= dissolve * strength;

      const noise = rand() * grain - grain / 2;
      const i3 = (y * width + x) * 3;
      for (let c = 0; c < 3; c += 1) {
        const value = PAPER[c] + (INK[c] - PAPER[c]) * cover + noise;
        out[i3 + c] = value < 0 ? 0 : value > 255 ? 255 : value;
      }
    }
  }

  return out;
}
