// Signature motion layer (homepage only). No libraries; works under the site's
// strict CSP (script-src 'self'). Content is fully visible without this file.
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('sig-ready');
  if (reduce) root.classList.add('sig-reduce');

  // 1. Hero entrance: split the headline into lines that slide up in turn.
  const h1 = document.querySelector('.ia-home-hero h1');
  if (h1 && !reduce) {
    const parts = h1.innerHTML.split(/<br\s*\/?>/i);
    h1.innerHTML = parts.map((p, i) => `<span class="sig-line"><span class="sig-line-in" data-i="${i}">${p}</span></span>`).join('');
    h1.querySelectorAll('.sig-line-in').forEach((el, i) => { el.style.transitionDelay = `${120 + i * 140}ms`; });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('sig-loaded')));

  // 2. Reveal on scroll, with stagger inside groups.
  const groups = [
    ['.hd-stat', 90], ['.hd-cards > li', 80], ['.hd-also li', 60], ['.hd-steps li', 140],
    ['.hd-checks li', 90], ['.project-start-sequence > li', 140], ['.ia-home-faq dl > div', 60],
  ];
  const targets = [];
  for (const [sel, step] of groups) {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('sig-reveal');
      el.style.transitionDelay = `${(i % 6) * step}ms`;
      targets.push(el);
    });
  }
  document.querySelectorAll('main .eyebrow, main h2, .hd-split-copy > p, .ia-section-intro > p').forEach((el) => {
    if (el.closest('.ia-home-hero')) return;
    el.classList.add('sig-reveal'); targets.push(el);
  });
  document.querySelectorAll('.project-start-sequence, .hd-steps').forEach((el) => targets.push(el));
  // A fully clipped element never reports as visible, so watch the section around each photo.
  document.querySelectorAll('.hd-split-photo').forEach((el) => { el.classList.add('sig-reveal'); targets.push(el.parentElement); });

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      e.target.querySelectorAll(':scope > .hd-split-photo').forEach((ph) => ph.classList.add('is-in'));
      io.unobserve(e.target);
      if (e.target.matches('.hd-stat')) countUp(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;
  if (io && !reduce) targets.forEach((el) => io.observe(el));
  else { targets.forEach((el) => el.classList.add('is-in')); document.querySelectorAll('.hd-split-photo').forEach((el) => el.classList.add('is-in')); }

  // 3. Count-up for numbers in the stat strip ("40+ years").
  function countUp(stat) {
    const n = stat.querySelector('[data-count]');
    if (!n || reduce) return;
    const end = Number(n.dataset.count); const t0 = performance.now(); const dur = 1400;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur); const eased = 1 - Math.pow(1 - k, 3);
      n.textContent = String(Math.round(end * eased));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (reduce) return;

  // 4. Hero depth: the photo drifts against the pointer and with scroll.
  const hero = document.querySelector('.ia-home-hero');
  const photo = hero?.querySelector('.hero-photo');
  const flow = hero?.querySelector('.sig-flow');
  let px = 0, py = 0, sy = 0, raf = 0;
  const paint = () => {
    raf = 0;
    if (photo) photo.style.transform = `translate3d(${px * -14}px, ${py * -10 + sy * 0.18}px, 0) scale(1.08)`;
    if (flow) flow.style.transform = `translate3d(${px * 10}px, ${py * 8 + sy * 0.08}px, 0)`;
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  if (hero && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; ask();
    });
    hero.addEventListener('pointerleave', () => { px = 0; py = 0; ask(); });
  }
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (hero && y < hero.offsetHeight) { sy = y; ask(); }
    bar && (bar.style.transform = `scaleX(${Math.min(1, y / Math.max(1, document.body.scrollHeight - innerHeight))})`);
  }, { passive: true });

  // 5. Thin scroll-progress line under the header.
  const bar = document.createElement('div');
  bar.className = 'sig-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
})();
