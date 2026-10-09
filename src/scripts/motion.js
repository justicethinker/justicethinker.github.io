/**
 * The site's entire script.
 *
 * Reveals, the menu, back-to-top and the contact form. Nothing here is
 * load-bearing: with scripting off, every page reads normally.
 */

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------------- reveals */

function initReveals() {
  const targets = document.querySelectorAll('[data-reveal], [data-plate]');
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
    // threshold 0 so a tall image that only ever shows a sliver still fires;
    // the negative bottom margin is what holds a reveal back until it is read.
    { rootMargin: '0px 0px -6% 0px', threshold: 0 },
  );

  targets.forEach((el) => observer.observe(el));

  // Safety net for content parked at the very end of a document, or stranded by
  // a restored scroll position: if a reader can see it, it gets lit.
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
    requestAnimationFrame(() => {
      drawer.setAttribute('data-open', 'true');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      // Focus can only land once the panel is actually visible, and visibility
      // arrives with the transition rather than with the attribute.
      grabFocus();
      window.setTimeout(grabFocus, 60);
    });
    restoreFocus = true;
  }

  function close() {
    drawer.setAttribute('data-open', 'false');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    window.setTimeout(
      () => {
        if (drawer.getAttribute('data-open') === 'false') drawer.hidden = true;
      },
      reduceQuery.matches ? 0 : 700,
    );
    if (restoreFocus) openBtn.focus();
    restoreFocus = false;
  }

  openBtn.addEventListener('click', () => {
    if (drawer.getAttribute('data-open') === 'true') close();
    else open();
  });

  closeBtn?.addEventListener('click', close);

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

  // Passing the breakpoint must not leave the page locked behind the panel.
  window.matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
    if (event.matches && drawer.getAttribute('data-open') === 'true') close();
  });
}

/* -------------------------------------------------------------- back to top */

function initToTop() {
  for (const button of document.querySelectorAll('[data-to-top]')) {
    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceQuery.matches ? 'auto' : 'smooth' });
    });
  }
}

/* ---------------------------------------------------------- contact form */

function initContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!(form instanceof HTMLFormElement)) return;

  const status = form.querySelector('[data-form-status]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();
    const subject = String(data.get('subject') || '').trim() || 'Hello from your site';

    if (!name || !email || !message) {
      if (status) status.textContent = 'A name, an email address and a message, please.';
      form.querySelector('input[name="name"]')?.focus();
      return;
    }

    const body = [message, '', `— ${name}`, email].join('\r\n');
    const href = `mailto:${form.dataset.contactEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    // A draft that cannot be re-opened is a dead end for anyone without a mail
    // client, so the composed message stays on the page.
    if (status) {
      status.textContent = 'Opening your mail client… ';
      const retry = document.createElement('a');
      retry.href = href;
      retry.textContent = 'open the draft again';
      status.append(retry);
    }

    window.location.href = href;
  });
}

/* -------------------------------------------------------------------- boot */

initReveals();
initMenu();
initToTop();
initContactForm();
