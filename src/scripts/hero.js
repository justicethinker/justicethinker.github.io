/**
 * The hero field — a warm constellation with its own small physics engine.
 * Its palette is effect-local and independent of the site theme.
 *
 * ~700 particles drift on spring return-to-home forces, push away from the
 * pointer (or the first touch), and link to near neighbours with faint gold
 * lines. A slow wireframe icosahedron turns at the centre. No physics
 * library: the integrator below is the engine — semi-implicit Euler on
 * particles with damping, springs and a radial pointer force.
 *
 * Anything can fail (no WebGL, no network for three.js, reduced motion) and
 * the page still reads: the canvas is decoration over a dark gradient.
 */

const canvas = document.querySelector('[data-hero-field]');
if (canvas instanceof HTMLCanvasElement) boot();

async function boot() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let THREE;
  try {
    THREE = await import(/* @vite-ignore */ 'three');
  } catch {
    return; // CDN unreachable — the gradient behind the canvas carries the hero.
  }

  const renderer = (() => {
    try {
      return new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return null;
    }
  })();
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 9;

  /* ---------------------------------------------------------- particles */

  const COUNT = window.innerWidth < 700 ? 320 : 700;
  const home = new Float32Array(COUNT * 3); // anchor positions
  const pos = new Float32Array(COUNT * 3); // live positions
  const vel = new Float32Array(COUNT * 3); // live velocities

  const spread = (i, range) => (Math.random() - 0.5) * range;

  for (let i = 0; i < COUNT; i++) {
    home[i * 3] = spread(i, 22);
    home[i * 3 + 1] = spread(i, 12);
    home[i * 3 + 2] = spread(i, 8);
    pos.set([home[i * 3], home[i * 3 + 1], home[i * 3 + 2]], i * 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  // Effect-local palette: this constellation keeps its own warm hue,
  // deliberately independent of the site's silver/white theme.
  const EFFECT = {
    hot: 'rgba(246,229,141,1)',
    mid: 'rgba(212,175,55,0.85)',
    faint: 'rgba(212,175,55,0)',
    dot: 0xd4af37,
    link: 0xd4af37,
    core: 0xf0d878,
    ring: 0xd4af37,
  };

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
    const tex = new THREE.CanvasTexture(c);
    return tex;
  })();

  const dots = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.16,
      map: sprite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: EFFECT.dot,
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
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.1, 1)),
    new THREE.LineBasicMaterial({
      color: EFFECT.core,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(core);

  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0);
      }),
    ),
    new THREE.LineBasicMaterial({
      color: EFFECT.ring,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2.6;
  scene.add(ring);

  /* ------------------------------------------------------------ pointer */

  // World-space repulsor. Eased toward the pointer so the field feels
  // like water, not like a cursor trail.
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

  window.addEventListener(
    'pointermove',
    (event) => {
      const p = toWorld(event.clientX, event.clientY);
      pointer.tx = p.x;
      pointer.ty = p.y;
      pointer.active = true;
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  /* --------------------------------------------------------------- loop
     The physics: every particle hangs off its anchor on a soft spring,
     loses energy to damping, and is shoved radially away from the
     pointer inside a small radius. Semi-implicit Euler, one substep. */

  const SPRING = 0.9;
  const DAMPING = 0.94;
  const PUSH_RADIUS = 3.2;
  const PUSH_FORCE = 26;

  function step(dt) {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const px = pos[ix];
      const py = pos[ix + 1];

      // Spring home + damping.
      let ax = (home[ix] - px) * SPRING;
      let ay = (home[ix + 1] - py) * SPRING;

      // Pointer repulsion.
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

      vel[ix] = (vel[ix] + ax * dt) * DAMPING;
      vel[ix + 1] = (vel[ix + 1] + ay * dt) * DAMPING;
      vel[ix + 2] = (vel[ix + 2] + (home[ix + 2] - pos[ix + 2]) * SPRING * dt) * DAMPING;

      pos[ix] += vel[ix] * dt * 3;
      pos[ix + 1] += vel[ix + 1] * dt * 3;
      pos[ix + 2] += vel[ix + 2] * dt * 3;
    }
    geo.attributes.position.needsUpdate = true;
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

  /* -------------------------------------------------------------- frame */

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Reduced motion: one composed frame, then stop. The art remains.
  step(1 / 60);
  core.rotation.y = 0.5;
  drawLinks();
  renderer.render(scene, camera);
  canvas.dataset.field = 'live';
  canvas.dataset.particles = String(COUNT);
  if (reduce) return;

  let last = performance.now();
  let visible = true;
  let frames = 0;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    step(dt);
    core.rotation.y += dt * 0.12;
    core.rotation.x += dt * 0.05;
    ring.rotation.z -= dt * 0.08;
    drawLinks();
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames);
  });
}
