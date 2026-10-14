/**
 * The site's entire shared script.
 *
 * Reveals, the menu, 3D card tilt, the portrait swap and back-to-top.
 * Nothing here is load-bearing: with scripting off, every page reads.
 */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------- reveals */

function initReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (targets.length === 0) return;

  if (reduceQuery.matches || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-lit'));
    return;
  }

  const light = (el) => {
    el.classList.add('is-lit');
    observer.unobserve(el);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) light(entry.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0 },
  );

  targets.forEach((el) => observer.observe(el));

  const sweep = () => {
    const viewport = window.innerHeight;
    for (const el of targets) {
      if (el.classList.contains('is-lit')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > 0 && rect.top < viewport) light(el);
    }
  };

  setTimeout(sweep, 1600);
  window.addEventListener('load', sweep);
  window.addEventListener('resize', sweep, { passive: true });
}

/* ------------------------------------------------------------------- menu */

function initMenu() {
  const drawer = document.querySelector('[data-drawer]');
  const scrim = document.querySelector('[data-scrim]');
  const openBtn = document.querySelector('[data-drawer-toggle]');
  const closeBtn = document.querySelector('[data-drawer-close]');
  if (!(drawer instanceof HTMLElement) || !(openBtn instanceof HTMLElement)) return;

  let restoreFocus = false;

  const focusables = () =>
    Array.from(drawer.querySelectorAll('a[href], button:not([disabled])')).filter(
      (el) => el instanceof HTMLElement && el.offsetParent !== null,
    );

  const grabFocus = () => focusables()[0]?.focus();

  function open() {
    drawer.hidden = false;
    if (scrim instanceof HTMLElement) scrim.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawer.setAttribute('data-open', 'true');
        if (scrim instanceof HTMLElement) scrim.style.opacity = '1';
      });
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      grabFocus();
      window.setTimeout(grabFocus, 60);
    });
    restoreFocus = true;
  }

  function close() {
    drawer.setAttribute('data-open', 'false');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (scrim instanceof HTMLElement) scrim.style.opacity = '0';
    window.setTimeout(
      () => {
        if (drawer.getAttribute('data-open') === 'false') {
          drawer.hidden = true;
          if (scrim instanceof HTMLElement) scrim.hidden = true;
        }
      },
      reduceQuery.matches ? 0 : 500,
    );
    if (restoreFocus) openBtn.focus();
    restoreFocus = false;
  }

  openBtn.addEventListener('click', () => {
    if (drawer.getAttribute('data-open') === 'true') close();
    else open();
  });

  closeBtn?.addEventListener('click', close);
  scrim?.addEventListener('click', close);

  drawer.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('a[href]')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (drawer.getAttribute('data-open') !== 'true') return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
    if (event.matches && drawer.getAttribute('data-open') === 'true') close();
  });
}

/* ------------------------------------------------------------------- tilt
   Cards lean toward the pointer in real 3D. Pure CSS transform, no library. */

function initTilt() {
  // No pointer-type gate: on touch screens pointermove simply never fires,
  // so the effect is desktop-only by nature rather than by media query.
  if (reduceQuery.matches) return;

  for (const card of document.querySelectorAll('[data-tilt]')) {
    if (!(card instanceof HTMLElement)) continue;
    let frame = 0;

    card.addEventListener('pointermove', (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg) translateZ(6px)`;
      });
    });

    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.style.transform = '';
    });
  }
}

/* -------------------------------------------------------------- back to top */

function initToTop() {
  for (const button of document.querySelectorAll('[data-to-top]')) {
    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceQuery.matches ? 'auto' : 'smooth' });
    });
  }
}

/* -------------------------------------------------------------------- boot */

initReveals();
initMenu();
initTilt();
initToTop();
