(function () {
  var root = document.documentElement;
  window.__bReady = true;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { root.classList.add('reveal-all'); return; }

  // Cable runs draw in as their section reaches view.
  var targets = document.querySelectorAll('main .section, main .page-hero, main .service-hero, .cta-band, main figure.realistic-visual');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  var pending = Array.prototype.slice.call(targets);
  pending.forEach(function (t) { t.classList.add('draw'); io.observe(t); });
  // Fast jumps can skip past an element between frames; anything above the fold line counts as seen.
  function sweep() {
    var line = window.innerHeight * 0.95;
    pending = pending.filter(function (t) {
      if (t.getBoundingClientRect().top < line) { t.classList.add('is-in'); io.unobserve(t); return false; }
      return true;
    });
  }

  // Pulse travel distance follows each list height.
  document.querySelectorAll('main ol').forEach(function (ol) {
    ol.style.setProperty('--run', Math.max(ol.offsetHeight - 28, 0) + 'px');
  });

  // Scroll cable on the edge of the rail.
  var ticking = false;
  function paint() {
    var h = root.scrollHeight - window.innerHeight;
    sweep();
    root.style.setProperty('--p', h > 0 ? Math.min(window.scrollY / h, 1).toFixed(4) : 0);
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();
})();
