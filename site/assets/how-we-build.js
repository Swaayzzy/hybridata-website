/* How We Build: tabs (Warehouse / MDF rack) and the step viewer.
   Each step is reached with the ‹ › buttons, a flick on touch or the arrow keys. No timers, no autoplay.
   Each 3D scene (the warehouse, the MDF rack) is fetched only when its picture is near the viewport. */
(function () {
  'use strict';
  var root = document.getElementById('how-we-build');
  if (!root) return;
  var FLICK_PX = 60;        // minimum horizontal travel for a flick that changes step
  var FLICK_MS = 320;       // slower drags orbit the rack instead
  var ALIAS = { rack: 'mdf-rack', building: 'warehouse' };   // deep links from the earlier version

  function el(tag, text) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  }

  function Viewer(panel) {
    var wrap = panel.querySelector('[data-wrap]');
    if (!wrap) { this.reset = this.go = function () {}; this.state = function () { return { step: 0, focus: '' }; }; return; }
    var frame = panel.querySelector('[data-frame]');
    var items = Array.prototype.slice.call(panel.querySelectorAll('.hwb-steps > li'));
    var n = items.length;
    var countEl = panel.querySelector('[data-count]');
    var nameEl = panel.querySelector('[data-name]');
    var capEl = panel.querySelector('[data-caption]');
    var bPrev = panel.querySelector('[data-prev]');
    var bNext = panel.querySelector('[data-next]');
    var picks = Array.prototype.slice.call(panel.querySelectorAll('.picker-row button'));
    var panelsOut = Array.prototype.slice.call(panel.querySelectorAll('.picker-panel'));
    var pickOut = panel.querySelector('.picker-out');
    var step = 1, focus = '', nogl = false;

    function render() {
      var li = items[step - 1];
      countEl.textContent = step + ' / ' + n;
      nameEl.textContent = li.querySelector('h3').textContent;
      capEl.innerHTML = li.querySelector('.hwb-cap').innerHTML;
      bPrev.disabled = step <= 1;
      bNext.disabled = step >= n;
      panel.dispatchEvent(new CustomEvent('hwb:state', { detail: { step: step, focus: focus } }));
    }

    function clearFocus() {
      focus = '';
      picks.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      panelsOut.forEach(function (p) { p.hidden = true; });
      if (pickOut) pickOut.hidden = true;
    }

    function go(k) {
      if (nogl) return;
      if (focus) clearFocus();
      step = Math.max(1, Math.min(n, k));
      render();
    }
    bPrev.addEventListener('click', function () { go(step - 1); });
    bNext.addEventListener('click', function () { go(step + 1); });

    // Arrow keys only act while focus is inside the viewer (buttons or the picture), never page-wide.
    wrap.addEventListener('keydown', function (ev) {
      if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(step - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(step + 1); }
    });

    // Flick on touch and pen. A quick, mostly horizontal flick changes step; a slower drag turns the rack.
    // The frame uses touch-action: pan-y, so vertical page scroll is untouched.
    var sx = 0, sy = 0, st = 0, tracking = false;
    frame.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      tracking = true; sx = e.clientX; sy = e.clientY; st = e.timeStamp;
    });
    frame.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (e.timeStamp - st <= FLICK_MS && Math.abs(dx) >= FLICK_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? step + 1 : step - 1);
    });
    frame.addEventListener('pointercancel', function () { tracking = false; });

    // Service picker: show the chosen service's line and "Get a quote"; the rack moves to the matching part.
    picks.forEach(function (b) {
      b.addEventListener('click', function () {
        var sys = b.getAttribute('data-sys');
        if (focus === sys) { clearFocus(); render(); return; }
        focus = sys;
        picks.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        panelsOut.forEach(function (p) { p.hidden = p.getAttribute('data-sys') !== sys; });
        if (pickOut) pickOut.hidden = false;
        if (nogl) return;   // the still shows the finished scene, so the caption stays on the last step
        step = Math.max(1, Math.min(n, +b.getAttribute('data-step') || n));
        countEl.textContent = step + ' / ' + n;
        nameEl.textContent = items[step - 1].querySelector('h3').textContent;
        capEl.innerHTML = items[step - 1].querySelector('.hwb-cap').innerHTML;
        bPrev.disabled = step <= 1; bNext.disabled = step >= n;
        panel.dispatchEvent(new CustomEvent('hwb:state', { detail: { step: step, focus: focus } }));
      });
    });

    // No WebGL: the picture is the finished scene, so show the last step's caption, with no arrows and no counter (hidden in CSS).
    panel.addEventListener('hwb:nogl', function () { nogl = true; clearFocus(); step = n; render(); });
    this.reset = function () { clearFocus(); step = nogl ? n : 1; render(); };
    this.go = go;
    this.state = function () { return { step: step, focus: focus }; };
  }

  /* A 3D scene (warehouse or MDF rack). Loaded when the picture is within a screen of the viewport. The scene normally runs in a
     module worker (drawing into a transferred OffscreenCanvas) so three.js never blocks the page; browsers without those run the
     same scene on the page's own thread. If WebGL is missing, a static image of the same final scene is shown instead. */
  var BASE = document.currentScript && document.currentScript.src;
  var SCENES = {
    'warehouse': { frame: '[data-scene]', still: '.scene-still', cls: 'scene-canvas', worker: 'warehouse-worker.js', main: './warehouse-3d.js' },
    'mdf-rack': { frame: '[data-mdf]', still: '.mdf-still', cls: 'mdf-canvas', worker: 'rack-worker.js', main: './rack-3d.js' }
  };
  var glOk = null;   // asked before anything creates a WebGL context, so a browser without it never logs context errors
  function hasWebGL() {
    if (glOk !== null) return glOk;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      glOk = !!gl;
      if (gl) { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    } catch (e) { glOk = false; }
    return glOk;
  }
  function Rack(panel, cfg) {
    var frame = panel.querySelector(cfg.frame);
    var still = frame && frame.querySelector(cfg.still);
    if (!frame) return;
    var latest = { step: 1, focus: '' }, started = false, ctl = null, canvas = null, worker = null, ro = null;
    var self = this;

    function showStill() {
      if (ro) ro.disconnect();
      if (worker) { worker.terminate(); worker = null; }
      if (canvas) { canvas.remove(); canvas = null; }
      ctl = null;
      frame.classList.remove('is-3d');
      if (resetBtn) resetBtn.hidden = true;
      frame.classList.add('is-still');
      panel.classList.add('is-nogl');
      panel.dispatchEvent(new CustomEvent('hwb:nogl'));
      if (still) { still.src = still.getAttribute('data-src'); still.hidden = false; }
    }
    function newCanvas() {
      var c = document.createElement('canvas');
      c.className = cfg.cls;
      c.setAttribute('aria-hidden', 'true');
      frame.insertBefore(c, frame.firstChild);
      return c;
    }
    function opts() {
      return {
        width: frame.clientWidth, height: frame.clientHeight, dpr: window.devicePixelRatio || 1,
        phone: Math.min(window.innerWidth, window.innerHeight) <= 820 || window.matchMedia('(pointer: coarse)').matches,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        step: latest.step, focus: latest.focus
      };
    }
    // Forward the canvas's pointer input to the scene (worker or in-page): drag turns, two fingers pinch, ctrl + wheel zooms.
    function wire(c) {
      function send(k, e) {
        var r = c.getBoundingClientRect();
        ctl.pointer(k, e.pointerId, e.clientX - r.left, e.clientY - r.top);
      }
      c.addEventListener('pointerdown', function (e) {
        if (!ctl || (e.pointerType === 'mouse' && e.button !== 0)) return;
        c.setPointerCapture(e.pointerId);
        send('down', e);
      });
      c.addEventListener('pointermove', function (e) { if (ctl) send('move', e); });
      c.addEventListener('pointerup', function (e) { if (ctl) send('up', e); });
      c.addEventListener('pointercancel', function (e) { if (ctl) send('up', e); });
      c.addEventListener('wheel', function (e) {
        if (!e.ctrlKey || !ctl) return;
        e.preventDefault();
        ctl.wheel(e.deltaY);
      }, { passive: false });
      if (window.ResizeObserver) {
        ro = new ResizeObserver(function () { if (ctl) ctl.size(frame.clientWidth, frame.clientHeight, window.devicePixelRatio || 1); });
        ro.observe(frame);
      }
    }
    // "Reset view": glide back to the current step's pose (the scene eases there, or cuts under reduced motion).
    var resetBtn = frame.querySelector('[data-reset]');
    if (resetBtn) resetBtn.addEventListener('click', function () { if (ctl) ctl.state(latest.step, latest.focus); });
    function ready() { frame.classList.add('is-3d'); if (resetBtn) resetBtn.hidden = false; if (still) still.remove(); still = null; }

    function startWorker() {
      canvas = newCanvas();
      var off = canvas.transferControlToOffscreen();
      worker = new Worker(new URL(cfg.worker, BASE), { type: 'module' });
      var o = opts(), done = false;
      function failOver(reason) {   // a canvas that went to a worker can't be drawn on again: start over with a fresh one
        if (done) return; done = true;
        if (worker) { worker.terminate(); worker = null; }
        if (canvas) { canvas.remove(); canvas = null; }
        ctl = null;
        if (reason === 'nogl') showStill(); else startMain();
      }
      worker.onerror = function () { failOver('error'); };
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.t === 'ready') { done = true; ready(); }
        else if (m.t === 'fail') failOver(/webgl|context/i.test(m.reason) ? 'nogl' : 'error');
      };
      ctl = {
        state: function (st, f) { worker.postMessage({ t: 'state', step: st, focus: f }); },
        size: function (w, h, d) { worker.postMessage({ t: 'size', w: w, h: h, dpr: d }); },
        pointer: function (k, id, x, y) { worker.postMessage({ t: 'pointer', k: k, id: id, x: x, y: y }); },
        wheel: function (dy) { worker.postMessage({ t: 'wheel', dy: dy }); },
        pose: function (p) { worker.postMessage({ t: 'pose', pose: p }); }
      };
      o.t = 'init'; o.canvas = off;
      worker.postMessage(o, [off]);
      wire(canvas);
    }
    function startMain() {
      if (!hasWebGL()) { showStill(); return; }
      import(cfg.main).then(function (m) {
        canvas = newCanvas();
        var scene = m.create(canvas, opts());
        ctl = {
          state: scene.setState, size: scene.setSize, pointer: scene.pointer, wheel: scene.wheel, pose: scene.pose
        };
        wire(canvas);
        ready();
      }).catch(function () { showStill(); });
    }
    function start() {
      if (started) return;
      started = true;
      if (!hasWebGL()) { showStill(); return; }
      var c = document.createElement('canvas');
      if (window.Worker && window.OffscreenCanvas && c.transferControlToOffscreen) {
        try { startWorker(); return; } catch (e) { if (canvas) { canvas.remove(); canvas = null; } if (worker) { worker.terminate(); worker = null; } ctl = null; }
      }
      startMain();
    }
    panel.addEventListener('hwb:state', function (ev) {
      latest = ev.detail;
      if (ctl) ctl.state(latest.step, latest.focus);
    });
    function queue() { if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 200); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); queue(); }
      }, { rootMargin: '300px 0px' });
      io.observe(frame);
    } else queue();
    Object.defineProperty(self, 'api', { get: function () { return ctl; } });
  }

  // Tabs. A tab marked hidden is skipped everywhere.
  var allTabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  function liveTabs() { return allTabs.filter(function (t) { return !t.hidden; }); }
  var viewers = {}, racks = {};
  allTabs.forEach(function (t) {
    var key = t.getAttribute('data-tab'), p = document.getElementById(t.getAttribute('aria-controls'));
    viewers[key] = new Viewer(p);
    if (SCENES[key]) racks[key] = new Rack(p, SCENES[key]);
  });

  var current = '';
  function firstKey() { var l = liveTabs(); return l.length ? l[0].getAttribute('data-tab') : ''; }
  function valid(k) { return liveTabs().some(function (t) { return t.getAttribute('data-tab') === k; }); }
  function select(key, focusTab, updateHash) {
    if (!valid(key)) key = valid('warehouse') ? 'warehouse' : firstKey();
    var changed = key !== current;
    allTabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = t.hidden || !on;
      if (on && focusTab) t.focus();
    });
    if (changed) { current = key; viewers[key].reset(); }
    // replaceState never scrolls and adds no history entry.
    if (updateHash && location.hash !== '#' + key && window.history && history.replaceState) history.replaceState(null, '', '#' + key);
  }
  function fromHash() { var h = location.hash.replace('#', ''); h = ALIAS[h] || h; return valid(h) ? h : 'warehouse'; }

  allTabs.forEach(function (t) {
    t.addEventListener('click', function () { select(t.getAttribute('data-tab'), false, true); });
    t.addEventListener('keydown', function (ev) {
      var tabs = liveTabs(), i = tabs.indexOf(t), j = -1;
      if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = tabs.length - 1;
      if (j < 0) return;
      ev.preventDefault();
      select(tabs[j].getAttribute('data-tab'), true, true);
    });
  });
  window.addEventListener('hashchange', function () { select(fromHash(), false, false); });

  root.classList.add('is-ready');
  // A single live tab has nothing to switch between, so the tab bar is hidden.
  if (liveTabs().length < 2) root.classList.add('is-single');
  select(fromHash(), false, false);
  window.__hwb = {
    state: function (k) { return viewers[k || current].state(); },
    select: function (k) { select(k, false, true); },
    go: function (k, s) { viewers[k].go(s); },
    get tab() { return current; },
    get rack() { return racks['mdf-rack'] && racks['mdf-rack'].api; },
    get warehouse() { return racks['warehouse'] && racks['warehouse'].api; }
  };
})();
