/**
 * The home field — the page's whole backdrop, not just its hero.
 *
 * ~700 particles hang off anchors on soft springs, lose energy to damping,
 * and are shoved radially away from the pointer. Hovering a section card pulls
 * the particles around that card inward and heats them, so the field answers
 * the content instead of merely sitting behind it.
 *
 * No physics library: the integrator below is the engine — semi-implicit
 * Euler on particles with damping, springs and a radial pointer force. The
 * animation runs on the shared stage loop, so there is one rAF per page,
 * paused when the tab is hidden.
 *
 * Anything can fail (no WebGL, no network for three.js, reduced motion) and
 * the page still reads: the canvas is decoration over a dark gradient.
 * Effect-local palette: independent of the site's silver/white theme.
 */

import { createStage } from './stage.js';
import bus, { SCENE } from './bus.js';

const EFFECT = {
  hot: 'rgba(246,229,141,1)',
  mid: 'rgba(212,175,55,0.85)',
  faint: 'rgba(212,175,55,0)',
  dot: 0xd4af37,
  link: 0xd4af37,
  core: 0xf0d878,
  ring: 0xd4af37,
  /** per-particle colour, multiplied by the sprite: dim by default, white-hot
   *  when the card next to it is being hovered. */
  cool: [0.88, 0.83, 0.62],
  warm: [1, 1, 0.9],
};

const canvas = document.querySelector('[data-hero-field]');
if (canvas instanceof HTMLCanvasElement) boot();

async function boot() {
  let THREE;
  try {
    THREE = await import(/* @vite-ignore */ 'three');
  } catch {
    return; // CDN unreachable — the gradient behind the canvas carries the page.
  }

  const renderer = (() => {
    try {
      return new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return null;
    }
  })();
  if (!renderer) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 9;

  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, EFFECT.hot);
    grad.addColorStop(0.35, EFFECT.mid);
    grad.addColorStop(1, EFFECT.faint);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  /* ---------------------------------------------------------- particles */

  const COUNT = window.innerWidth < 700 ? 320 : window.innerWidth < 1200 ? 520 : 700;
  const home = new Float32Array(COUNT * 3);
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const heat = new Float32Array(COUNT);

  const spread = (range) => (Math.random() - 0.5) * range;

  for (let i = 0; i < COUNT; i++) {
    // Spread across the frustum, not a hero-sized box: the field is the page
    // now, and it stays behind every section as the reader scrolls. The depth
    // range is what makes the near particles small and the far ones wide.
    home[i * 3] = spread(26);
    home[i * 3 + 1] = spread(15);
    home[i * 3 + 2] = spread(10);
    pos.set([home[i * 3], home[i * 3 + 1], home[i * 3 + 2]], i * 3);
    colors.set(EFFECT.cool, i * 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const dots = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.19,
      map: sprite,
      transparent: true,
      opacity: 0.92,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dots);

  /* -------------------------------------------------------------- links */

  const LINK_DIST = 1.9;
  const linkGeo = new THREE.BufferGeometry();
  const linkPos = new Float32Array(COUNT * 6 * 3);
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
  const links = new THREE.LineSegments(
    linkGeo,
    new THREE.LineBasicMaterial({
      color: EFFECT.link,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(links);

  /* --------------------------------------------------------------- core */

  const core = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.4, 1)),
    new THREE.LineBasicMaterial({
      color: EFFECT.core,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(core);

  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0);
      }),
    ),
    new THREE.LineBasicMaterial({
      color: EFFECT.ring,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2.6;
  scene.add(ring);

  /* ------------------------------------------------------------ pointer */

  const pointer = { x: 999, y: 999, tx: 999, ty: 999, active: false };
  const toWorld = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = -camera.position.z / dir.z;
    return { x: camera.position.x + dir.x * t, y: camera.position.y + dir.y * t };
  };

  bus.on('pointer', (detail) => {
    if (!detail?.event) {
      pointer.active = false;
      return;
    }
    const p = toWorld(detail.event.clientX, detail.event.clientY);
    pointer.tx = p.x;
    pointer.ty = p.y;
    pointer.active = true;
  });

  /* ----------------------------------------------------------- the cards
     Content → scene: hovering a section card pulls the neighbouring particles
     toward it and lights them. */

  const attract = { x: 0, y: 0, tx: 0, ty: 0, on: false, radius: 7 };

  bus.on(SCENE.hover, (detail) => {
    if (!detail?.rect) {
      attract.on = false;
      return;
    }
    const r = detail.rect;
    // Cards closest to the middle of the page pull hardest.
    const p = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    attract.tx = p.x;
    attract.ty = p.y;
    attract.on = true;
    if (!attract.x && !attract.y) {
      attract.x = p.x;
      attract.y = p.y;
    }
  });

  /* --------------------------------------------------------------- loop */

  const SPRING = 0.9;
  const DAMPING = 0.94;
  const PUSH_RADIUS = 3.2;
  const PUSH_FORCE = 26;
  const PULL_FORCE = 30;

  function step(dt) {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;

    if (attract.on) {
      attract.x += (attract.tx - attract.x) * 0.1;
      attract.y += (attract.ty - attract.y) * 0.1;
      attract.radius += (7 - attract.radius) * 0.1;
    }

    const R2 = attract.radius * attract.radius;

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const px = pos[ix];
      const py = pos[ix + 1];

      let ax = (home[ix] - px) * SPRING;
      let ay = (home[ix + 1] - py) * SPRING;
      let lit = 0;

      if (pointer.active) {
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < PUSH_RADIUS * PUSH_RADIUS && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const f = ((PUSH_RADIUS - d) / PUSH_RADIUS) * PUSH_FORCE;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
      }

      if (attract.on) {
        const dx = attract.x - px;
        const dy = attract.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const f = (1 - d / attract.radius) * PULL_FORCE;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
          lit = 1 - d / attract.radius;
        }
      }

      // Heat fades in near the hovered card and cools again after.
      const target = lit;
      heat[i] += (target - heat[i]) * Math.min(1, (dt || 1 / 60) * 4);
      const h = heat[i];
      const c = i * 3;
      colors[c] = EFFECT.cool[0] + (EFFECT.warm[0] - EFFECT.cool[0]) * h;
      colors[c + 1] = EFFECT.cool[1] + (EFFECT.warm[1] - EFFECT.cool[1]) * h;
      colors[c + 2] = EFFECT.cool[2] + (EFFECT.warm[2] - EFFECT.cool[2]) * h;

      vel[ix] = (vel[ix] + ax * dt) * DAMPING;
      vel[ix + 1] = (vel[ix + 1] + ay * dt) * DAMPING;
      vel[ix + 2] = (vel[ix + 2] + (home[ix + 2] - pos[ix + 2]) * SPRING * dt) * DAMPING;

      pos[ix] += vel[ix] * dt * 3;
      pos[ix + 1] += vel[ix + 1] * dt * 3;
      pos[ix + 2] += vel[ix + 2] * dt * 3;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function drawLinks() {
    let n = 0;
    const max = linkPos.length / 3;
    outer: for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        if (Math.abs(dx) > LINK_DIST || Math.abs(dy) > LINK_DIST) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK_DIST * LINK_DIST) continue;
        linkPos.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], n * 3);
        linkPos.set([pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], n * 3 + 3);
        n += 2;
        if (n + 2 >= max) break outer;
      }
    }
    linkGeo.setDrawRange(0, n);
    linkGeo.attributes.position.needsUpdate = true;
  }

  /* --------------------------------------------------------------- frame */

  // `let`, not `const`: the first frame runs from inside createStage, before
  // this binding exists, so a const would be in its temporal dead zone.
  let stage = null;
  stage = createStage({
    canvas,
    name: 'field',
    // The stage publishes the pointer on the bus; the field reads it there
    // rather than adding a second listener of its own.
    trackPointer: true,
    onResize: (s) => {
      renderer.setPixelRatio(s.dpr);
      renderer.setSize(s.w, s.h, false);
      camera.aspect = s.w / s.h;
      camera.updateProjectionMatrix();
    },
    onFrame: (dt) => {
      step(dt);
      if (!stage?.still) {
        core.rotation.y += dt * 0.12;
        core.rotation.x += dt * 0.05;
        ring.rotation.z -= dt * 0.08;
      }
      drawLinks();
      renderer.render(scene, camera);
      canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);

      // Observable state for the field: is a card pulling, how many particles
      // answered, and how far the pulled ones still are from it.
      let lit = 0;
      let sum = 0;
      for (let i = 0; i < COUNT; i++) {
        if (heat[i] > 0.25) {
          lit++;
          sum += Math.hypot(attract.x - pos[i * 3], attract.y - pos[i * 3 + 1]);
        }
      }
      canvas.dataset.attract = attract.on ? 'on' : 'off';
      canvas.dataset.lit = String(lit);
      canvas.dataset.pull = String(lit ? (sum / lit).toFixed(2) : '');
    },
  });
  if (!stage) return;

  canvas.dataset.field = 'live';
  canvas.dataset.particles = String(COUNT);
}
