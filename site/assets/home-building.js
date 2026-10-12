/* Home "Inside the building": scroll story + service picker over the 2D cutaway. */
(function () {
  'use strict';
  var S = window.HybStage;
  var section = document.getElementById('inside-the-building');
  if (!S || !section) return;
  var frame = section.querySelector('.stage-frame');
  var svg = section.querySelector('svg.bld-svg');
  var steps = Array.prototype.slice.call(section.querySelectorAll('.story-step'));
  var prev = section.querySelector('[data-stage-prev]');
  var next = section.querySelector('[data-stage-next]');
  var status = section.querySelector('.stage-status');
  var picks = Array.prototype.slice.call(section.querySelectorAll('.picker-row button'));
  var panels = Array.prototype.slice.call(section.querySelectorAll('.picker-panel'));
  var hint = section.querySelector('.picker-hint');
  var bld = section.querySelector('.bld');

  var NAMES = ['Street', 'Ground floor opens', 'Riser', 'Horizontal', 'Wireless', 'Surveillance', 'Access control', 'Everything on'];
  var LABELS = {
    1: [{ text: 'Handhole at the kerb', ax: 57, ay: 400 }, { text: 'Underground conduit with OSP fiber', ax: 140, ay: 462 }],
    2: [{ text: 'Fiber enclosure and splice point', ax: 176, ay: 332 }, { text: 'MDF rack: panels, switches, UPS', ax: 227, ay: 360 }],
    3: [{ text: 'Firestopped riser sleeves', ax: 281, ay: 209 }, { text: 'IDF, floor 2', ax: 244, ay: 268 }, { text: 'IDF, floor 3', ax: 244, ay: 168 }],
    4: [{ text: 'Cable tray along the corridor', ax: 370, ay: 223 }, { text: 'J-hooks branch to outlets', ax: 440, ay: 262 }],
    5: [{ text: 'Ceiling access point', ax: 340, ay: 240 }, { text: 'Coverage (illustrative)', ax: 432, ay: 290 }],
    6: [{ text: 'Entry camera', ax: 150, ay: 336 }, { text: 'Corridor camera', ax: 480, ay: 238 }, { text: 'Parking camera', ax: 604, ay: 350 }],
    7: [{ text: 'Reader at the latch side', ax: 399, ay: 280 }, { text: 'Panel in the IDF', ax: 231, ay: 291 }],
    8: []
  };
  var FOCUS_LABELS = {
    fiber: [{ text: 'OSP fiber from the kerb', ax: 140, ay: 462 }, { text: 'Riser backbone', ax: 279, ay: 250 }],
    cabling: [{ text: 'MDF rack', ax: 227, ay: 360 }, { text: 'IDFs on each floor', ax: 244, ay: 268 }, { text: 'Tray and J-hooks', ax: 380, ay: 223 }],
    wireless: [{ text: 'Ceiling access points', ax: 340, ay: 236 }, { text: 'Coverage (illustrative)', ax: 432, ay: 290 }],
    surveillance: [{ text: 'Entry camera', ax: 150, ay: 336 }, { text: 'Corridor camera', ax: 480, ay: 238 }, { text: 'Parking camera', ax: 604, ay: 350 }],
    access: [{ text: 'Readers on door frames', ax: 399, ay: 280 }, { text: 'Panel in the IDF', ax: 231, ay: 291 }]
  };

  window.__hybLabelCheck = window.__hybLabelCheck || {};
  var toggle = S.initToggle(section, 'home');
  var labels = S.createLabels({ frame: frame, vb: { w: 640, h: 600 }, draw: { x: 0, y: 78, w: 640, h: 462 }, mode: 'tb', max: 3 });
  var stage = 0, focus = '';

  function render() {
    S.applyStage(svg, focus ? 8 : stage, focus);
    if (focus) bld.setAttribute('data-focus', focus); else bld.removeAttribute('data-focus');
    bld.setAttribute('data-stage', String(focus ? 8 : stage));
    if (toggle.view === '3d' && toggle.handle) { labels.show([]); toggle.handle.setState(stage, focus); window.__hybLabelCheck.home = toggle.handle.check; }
    else { labels.show(focus ? FOCUS_LABELS[focus] : LABELS[stage]); window.__hybLabelCheck.home = labels.check; }
    steps.forEach(function (st, i) { st.classList.toggle('is-active', i + 1 === stage); });
    if (status) status.textContent = stage + '/8 · ' + NAMES[stage - 1];
    if (prev) prev.disabled = stage <= 1;
    if (next) next.disabled = stage >= 8;
  }

  function setStage(n) {
    if (n === stage) return;
    stage = n;
    if (focus && n !== 8) clearFocus(false);
    render();
  }

  function clearFocus(rerender) {
    focus = '';
    picks.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    panels.forEach(function (p) { p.hidden = true; });
    if (hint) hint.hidden = false;
    if (rerender !== false) render();
  }

  // Active step = last step whose top has passed the reading line (just under the sticky stage on phones, mid-screen on desktop).
  var sticky = section.querySelector('.stage-sticky');
  function readLine() {
    // On phones and tablets measure where the bottom of the stage will be once it is pinned, not where it is now (it may not be pinned yet).
    if (window.matchMedia('(max-width: 900px)').matches) return (parseFloat(getComputedStyle(sticky).top) || 0) + sticky.offsetHeight + 24;
    return window.innerHeight * 0.5;
  }
  function setStickyVar() { section.style.setProperty('--sticky-h', Math.round(sticky.getBoundingClientRect().height) + 'px'); }
  if (window.ResizeObserver) new ResizeObserver(setStickyVar).observe(sticky);
  setStickyVar();
  function activeFromScroll() {
    var line = readLine();
    var n = 1;
    for (var i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= line) n = i + 1;
    return n;
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; setStage(activeFromScroll()); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  function goTo(n) {
    var el = steps[n - 1];
    if (!el) return;
    var r = el.getBoundingClientRect();
    var line = readLine();
    window.scrollBy({ top: r.top - line + 8, behavior: S.reduceMotion() ? 'auto' : 'smooth' });
  }
  if (prev) prev.addEventListener('click', function () { goTo(Math.max(1, stage - 1)); });
  if (next) next.addEventListener('click', function () { goTo(Math.min(8, stage + 1)); });

  picks.forEach(function (b) {
    b.addEventListener('click', function () {
      var sys = b.getAttribute('data-sys');
      if (focus === sys) { clearFocus(); return; }
      focus = sys;
      picks.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-sys') !== sys; });
      if (hint) hint.hidden = true;
      render();
    });
  });

  toggle.onChange(function () { render(); });
  section.classList.add('is-ready');
  stage = activeFromScroll();
  render();
  // Capable devices get the 3D view by default, fetched only when the section nears the screen.
  // ?eager=1 (testing only, used by the QA gate) mounts at once instead of waiting for the section to near the screen.
  if (!S.force2DReason() && /[?&]eager=1\b/.test(location.search)) {
    toggle.set('3d');
  } else if (!S.force2DReason() && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); toggle.set('3d'); }
    }, { rootMargin: '400px 0px' });
    io.observe(section);
  }
  window.__hybHome = { setStage: setStage, get stage() { return stage; }, view: function () { return toggle.view; } };
})();
