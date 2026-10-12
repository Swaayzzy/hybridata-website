/* How We Build: two small extras for the art. Neither touches the player state.
   1. Phones get the cropped viewBox (building about 90% of the frame width); wider screens get the full one.
   2. Subtle parallax between the art layers (pointer on desktop, scroll on phones). Off with reduced motion, off screen
      and on a hidden tab. Moves only the transform attribute of the three .px groups. */
(function () {
  'use strict';
  var root = document.getElementById('how-we-build');
  if (!root) return;
  var svgs = Array.prototype.slice.call(root.querySelectorAll('svg[data-art]'));
  var mqPhone = window.matchMedia('(max-width: 680px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var AMP = 3;                       // viewBox units at the extreme, so it stays subtle
  var FACTOR = [-1, 0, 1];           // back, middle, front layer

  function setViewBox() {
    svgs.forEach(function (s) { s.setAttribute('viewBox', s.getAttribute(mqPhone.matches ? 'data-vb-n' : 'data-vb-w')); });
  }
  setViewBox();
  if (mqPhone.addEventListener) mqPhone.addEventListener('change', setViewBox); else if (mqPhone.addListener) mqPhone.addListener(setViewBox);

  var rigs = svgs.map(function (s) {
    var frame = s.parentNode;
    var px = [];
    Array.prototype.forEach.call(s.querySelectorAll('.px'), function (g) { px[parseInt(g.getAttribute('data-px'), 10)] = g; });
    return { svg: s, frame: frame, px: px, x: 0, y: 0, tx: 0, ty: 0, on: false, raf: 0, ptr: 0, ptrY: 0 };
  });

  function paint(r) {
    for (var i = 0; i < 3; i++) {
      if (!r.px[i]) continue;
      if (Math.abs(r.x) < .02 && Math.abs(r.y) < .02) r.px[i].removeAttribute('transform');
      else r.px[i].setAttribute('transform', 'translate(' + (r.x * FACTOR[i]).toFixed(2) + ' ' + (r.y * FACTOR[i]).toFixed(2) + ')');
    }
  }
  function live(r) { return r.on && !document.hidden && !mqReduce.matches && r.frame.offsetParent !== null; }
  function scrollTarget(r) {
    var b = r.frame.getBoundingClientRect();
    var c = (b.top + b.height / 2) / window.innerHeight - .5;       // -0.5 .. 0.5 across the viewport
    return Math.max(-1, Math.min(1, c * 2)) * AMP;
  }
  function step(r) {
    r.raf = 0;
    if (!live(r)) { r.x = r.y = 0; paint(r); return; }
    r.tx = r.ptr * AMP;
    r.ty = r.ptrY * AMP + scrollTarget(r) * (r.ptr || r.ptrY ? .5 : 1);
    r.x += (r.tx - r.x) * .12; r.y += (r.ty - r.y) * .12;
    paint(r);
    if (Math.abs(r.tx - r.x) > .03 || Math.abs(r.ty - r.y) > .03) r.raf = requestAnimationFrame(function () { step(r); });
  }
  function kick(r) { if (!r.raf) r.raf = requestAnimationFrame(function () { step(r); }); }

  rigs.forEach(function (r) {
    r.frame.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var b = r.frame.getBoundingClientRect();
      r.ptr = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - .5) * 2));
      r.ptrY = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - .5) * 2));
      kick(r);
    });
    r.frame.addEventListener('pointerleave', function () { r.ptr = r.ptrY = 0; kick(r); });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        rigs.forEach(function (r) { if (r.frame === e.target) { r.on = e.isIntersecting; kick(r); } });
      });
    }, { threshold: [0, .1] });
    rigs.forEach(function (r) { io.observe(r.frame); });
  }
  window.addEventListener('scroll', function () { rigs.forEach(function (r) { if (r.on) kick(r); }); }, { passive: true });
  document.addEventListener('visibilitychange', function () { rigs.forEach(kick); });
  var onReduce = function () { rigs.forEach(kick); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce); else if (mqReduce.addListener) mqReduce.addListener(onReduce);
})();
