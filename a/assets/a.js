(function () {
  var g = window.gsap, ST = window.ScrollTrigger;
  if (!g || !ST) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  g.registerPlugin(ST);
  var doc = document.documentElement;
  doc.classList.add('motion');

  var hero = document.querySelector('.hero, .page-hero, .service-hero');
  if (hero) {
    var kids = hero.querySelectorAll('.eyebrow, h1, .hero-copy, .lead, .actions, .hero-about');
    g.from(kids, { y: 36, opacity: 0, duration: .9, ease: 'power3.out', stagger: .12, delay: .1, clearProps: 'all' });
    var ph = hero.querySelector('.hero-photo img, .realistic-visual img');
    if (ph) g.fromTo(ph, { scale: 1.08 }, { scale: 1, duration: 2.2, ease: 'power2.out' });
    if (ph) g.to(ph, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  var strip = document.querySelector('.proof-strip');
  if (strip) g.from(strip.children, { y: 24, opacity: 0, duration: .7, stagger: .1, ease: 'power2.out', scrollTrigger: { trigger: strip, start: 'top 92%', once: true }, clearProps: 'all' });

  var groups = [
    ['.home-pathway-step', 'x', 40], ['.project-start-sequence li', 'y', 40],
    ['.proof-editorial dl > div', 'y', 30], ['.credit-card', 'y', 30], ['.process-gate', 'y', 30],
    ['.sector-index > *', 'y', 30], ['.service-map-copy', 'y', 30], ['.related-links > *', 'y', 24]
  ];
  groups.forEach(function (gr) {
    g.utils.toArray(gr[0]).forEach(function (el) {
      var v = { opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'all', scrollTrigger: { trigger: el, start: 'top 88%', once: true } };
      v[gr[1]] = gr[2];
      g.from(el, v);
    });
  });

  g.utils.toArray('.section .ia-section-intro, .close-grid > div, .cta-band .wrap > div').forEach(function (el) {
    g.from(el, { y: 32, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'all', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // numbered process: light each step's marker as it crosses the middle of the screen
  g.utils.toArray('.home-pathway-step').forEach(function (el) {
    ST.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', toggleClass: { targets: el, className: 'is-current' } });
  });
})();
