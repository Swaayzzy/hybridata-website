/* Data center "Build the rack": range slider over the 2D rack elevation, with a one-time auto-build on first view. */
(function () {
  'use strict';
  var S = window.HybStage;
  var section = document.getElementById('build-the-rack');
  if (!S || !section) return;
  var frame = section.querySelector('.stage-frame');
  var svg = section.querySelector('svg.rack-svg');
  var range = section.querySelector('.rack-range');
  var nameEl = section.querySelector('.rack-stop-name');
  var numEl = section.querySelector('.rack-stop-num');
  var copyEl = section.querySelector('.rack-copy');
  var items = Array.prototype.slice.call(section.querySelectorAll('.stop-list li'));
  var rack = section.querySelector('.rack');
  var readout = section.querySelector('.rack-readout');

  var STOPS = [
    { name: 'Empty rack', copy: 'A 4-post rack stands under the ladder rack, bonded to the grounding busbar.' },
    { name: 'Cable management', copy: 'Vertical and horizontal managers give every cord a clear path.' },
    { name: 'Patch panels', copy: 'Copper panels and a fiber enclosure mount, with each port position labeled.' },
    { name: 'Switches', copy: 'Switches mount and their port LEDs come on.' },
    { name: 'Dressed bundles', copy: 'Dressed so the next tech can trace any port in seconds.' },
    { name: 'Fiber spliced and tested', copy: 'The trunk lands in the enclosure, the splice is fused and sleeved, and the test trace is documented. Trace shown is illustrative.' }
  ];
  var LABELS = {
    1: [{ text: 'Overhead ladder rack', ax: 240, ay: 60 }, { text: 'Grounding busbar', ax: 112, ay: 639 }],
    2: [{ text: 'Vertical manager', ax: 119, ay: 300 }, { text: 'Horizontal manager', ax: 328, ay: 158 }],
    3: [{ text: 'Fiber enclosure', ax: 152, ay: 116 }, { text: 'Copper patch panel', ax: 328, ay: 152 }, { text: 'Port positions labeled', ax: 330, ay: 224 }],
    4: [{ text: 'Switch', ax: 328, ay: 260 }, { text: 'Port LEDs', ax: 300, ay: 254 }],
    5: [{ text: 'Hook-and-loop wraps', ax: 129, ay: 200 }, { text: 'Label tags', ax: 145, ay: 244 }],
    6: [{ text: 'Fiber trunk', ax: 376, ay: 90 }, { text: 'Splice tray', ax: 328, ay: 360 }, { text: 'Test trace (illustrative)', ax: 320, ay: 480 }]
  };

  window.__hybLabelCheck = window.__hybLabelCheck || {};
  var toggle = S.initToggle(section, 'rack');
  var labels = S.createLabels({ frame: frame, vb: { w: 480, h: 680 }, draw: { x: 98, y: 20, w: 286, h: 630 }, mode: 'lr', max: 3 });
  var stop = 0, timer = 0, auto = false, ctrl = false;

  function set(n, fromUser) {
    n = Math.max(1, Math.min(6, n));
    if (range.value !== String(n)) range.value = String(n);
    if (n === stop) return;
    stop = n;
    rack.setAttribute('data-stop', String(n));
    S.applyStage(svg, n, '');
    if (toggle.view === '3d' && toggle.handle) { labels.show([]); toggle.handle.setState(n); window.__hybLabelCheck.rack = toggle.handle.check; }
    else labels.show(LABELS[n]);
    var s = STOPS[n - 1];
    nameEl.textContent = s.name;
    numEl.textContent = 'Stop ' + n + ' of 6';
    copyEl.textContent = s.copy;
    range.setAttribute('aria-valuetext', 'Stop ' + n + ' of 6: ' + s.name);
    items.forEach(function (li, i) { li.classList.toggle('is-active', i + 1 === n); });
  }

  function stopAuto() { if (timer) { clearTimeout(timer); timer = 0; } readout.setAttribute('aria-live', 'polite'); }
  function user() { ctrl = true; stopAuto(); }
  range.addEventListener('pointerdown', user);
  range.addEventListener('keydown', user);
  range.addEventListener('input', function () { user(); set(parseInt(range.value, 10)); });

  function autoBuild() {
    auto = true;
    readout.setAttribute('aria-live', 'off');
    (function stepUp() {
      timer = 0;
      if (ctrl) return;
      if (stop >= 6) { stopAuto(); return; }
      set(stop + 1);
      timer = setTimeout(stepUp, 750);
    })();
  }

  // The one-time auto-build waits (up to 5 s) for the 3D view when it is on its way, so the visitor sees the build in 3D, not a jump.
  var want3d = !S.force2DReason() && 'IntersectionObserver' in window, waited = 0;
  function startWhenReady() {
    timer = 0;
    if (ctrl || auto) return;
    if (want3d && toggle.view !== '3d' && waited < 5000) { waited += 250; timer = setTimeout(startWhenReady, 250); return; }
    autoBuild();
  }

  // When the 3D view mounts (or the visitor switches views) show the current stop in it; back to 2D redraws the 2D labels.
  toggle.onChange(function (view, handle) {
    if (view === '3d' && handle) { labels.show([]); handle.setState(stop); window.__hybLabelCheck.rack = handle.check; }
    else { labels.show(LABELS[stop]); window.__hybLabelCheck.rack = labels.check; }
  });

  section.classList.add('is-ready');
  var reduce = S.reduceMotion();
  set(reduce ? 6 : 1);
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !auto && !ctrl) { io.disconnect(); timer = setTimeout(startWhenReady, 400); }
    }, { threshold: 0.5 });
    io.observe(frame);
  } else if (!reduce) {
    set(6);
  }
  window.__hybRack = { set: set, get stop() { return stop; }, view: function () { return toggle.view; } };
  window.__hybLabelCheck.rack = labels.check;

  // 3D view. Same start rule as the home section: it starts only when ALL of these hold: the page has loaded, the browser has been
  // idle (2 s timeout fallback), and the section is within 100 px of the screen or the visitor has scrolled or touched the page.
  // The 2D rack stays in place until the 3D canvas is attached (same frame size, no layout shift).
  // ?eager=1 (testing only, used by the QA gate) mounts at once.
  if (!S.force2DReason() && /[?&]eager=1\b/.test(location.search)) {
    toggle.set('3d');
  } else if (!S.force2DReason() && 'IntersectionObserver' in window) {
    var idle = false, near = false, touched = false, started = false;
    var io3 = new IntersectionObserver(function (es) { near = es.some(function (e) { return e.isIntersecting; }); go(); }, { rootMargin: '100px 0px' });
    var kinds = ['scroll', 'touchstart', 'wheel', 'keydown'];
    var onInput = function () { touched = true; go(); };
    var go = function () {
      if (started || !idle || !(near || touched)) return;
      started = true; io3.disconnect();
      kinds.forEach(function (k) { window.removeEventListener(k, onInput); });
      toggle.set('3d');
    };
    kinds.forEach(function (k) { window.addEventListener(k, onInput, { passive: true }); });
    io3.observe(section);
    var afterLoad = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(function () { idle = true; go(); }, { timeout: 2000 });
      else setTimeout(function () { idle = true; go(); }, 2000);
    };
    if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad, { once: true });
  }
})();
