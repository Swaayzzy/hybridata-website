/* How We Build: tabs (Warehouse / MDF rack) and the step viewer.
   Each step is reached with the ‹ › buttons, a flick on touch or the arrow keys. No timers, no autoplay.
   The MDF rack's 3D scene (rack-3d.js) is fetched only when its picture is near the viewport. */
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
    var step = 1, focus = '';

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
        step = n;
        countEl.textContent = step + ' / ' + n;
        nameEl.textContent = items[step - 1].querySelector('h3').textContent;
        capEl.innerHTML = items[step - 1].querySelector('.hwb-cap').innerHTML;
        bPrev.disabled = false; bNext.disabled = true;
        panel.dispatchEvent(new CustomEvent('hwb:state', { detail: { step: step, focus: focus } }));
      });
    });

    this.reset = function () { clearFocus(); step = 1; render(); };
    this.go = go;
    this.state = function () { return { step: step, focus: focus }; };
  }

  /* The 3D rack. Loaded when the picture is within a screen of the viewport; a static image of the same final scene
     replaces it only if WebGL is missing (or the bundle fails to load). */
  function Rack(panel) {
    var frame = panel.querySelector('[data-mdf]');
    var still = frame && frame.querySelector('.mdf-still');
    if (!frame) return;
    var latest = { step: 1, focus: '' }, api = null, started = false;

    function showStill() { frame.classList.add('is-still'); if (still) { still.src = still.getAttribute('data-src'); still.hidden = false; } }
    function hasWebGL() {
      try {
        var c = document.createElement('canvas');
        var gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return false;
        var x = gl.getExtension('WEBGL_lose_context');
        if (x) x.loseContext();
        return true;
      } catch (e) { return false; }
    }
    function start() {
      if (started) return;
      started = true;
      if (!hasWebGL()) { showStill(); return; }
      import('./rack-3d.js').then(function (m) {
        api = m.mount(frame, {
          phone: Math.min(window.innerWidth, window.innerHeight) <= 820 || window.matchMedia('(pointer: coarse)').matches,
          reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          step: latest.step, focus: latest.focus
        });
        frame.classList.add('is-3d');
        if (still) still.remove();
      }).catch(function () { showStill(); });
    }
    panel.addEventListener('hwb:state', function (ev) {
      latest = ev.detail;
      if (api) api.setState(latest.step, latest.focus);
    });
    function queue() { if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 200); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); queue(); }
      }, { rootMargin: '300px 0px' });
      io.observe(frame);
    } else queue();
    Object.defineProperty(this, 'api', { get: function () { return api; } });
  }

  // Tabs. A tab marked hidden (the Warehouse slot until it lands) is skipped everywhere.
  var allTabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  function liveTabs() { return allTabs.filter(function (t) { return !t.hidden; }); }
  var viewers = {}, racks = {};
  allTabs.forEach(function (t) {
    var key = t.getAttribute('data-tab'), p = document.getElementById(t.getAttribute('aria-controls'));
    viewers[key] = new Viewer(p);
    if (key === 'mdf-rack') racks[key] = new Rack(p);
  });

  var current = '';
  function firstKey() { var l = liveTabs(); return l.length ? l[0].getAttribute('data-tab') : ''; }
  function valid(k) { return liveTabs().some(function (t) { return t.getAttribute('data-tab') === k; }); }
  function select(key, focusTab, updateHash) {
    if (!valid(key)) key = valid('mdf-rack') ? 'mdf-rack' : firstKey();
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
  function fromHash() { var h = location.hash.replace('#', ''); h = ALIAS[h] || h; return valid(h) ? h : 'mdf-rack'; }

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
    get rack() { return racks['mdf-rack'] && racks['mdf-rack'].api; }
  };
})();
