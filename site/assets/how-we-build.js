/* How We Build: tabs (Building / Data Center Rack) and the step viewer.
   Each step is a still frame of the art, reached with the ‹ › buttons, a swipe or the arrow keys. No timers, no autoplay.
   Art goes in through the SVG groups (.L[data-from][data-system]); this file never touches the drawing itself. */
(function () {
  'use strict';
  var root = document.getElementById('how-we-build');
  if (!root) return;
  var SWIPE_PX = 40;        // minimum horizontal travel for a swipe

  function el(tag, text) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  }

  function Viewer(panel) {
    var wrap = panel.querySelector('[data-wrap]');
    var frame = panel.querySelector('[data-frame]');
    var svg = panel.querySelector('svg[data-art]');
    var items = Array.prototype.slice.call(panel.querySelectorAll('.hwb-steps > li'));
    var n = items.length;
    var countEl = panel.querySelector('[data-count]');
    var nameEl = panel.querySelector('[data-name]');
    var capEl = panel.querySelector('[data-caption]');
    var tagsEl = panel.querySelector('[data-tags]');
    var bPrev = panel.querySelector('[data-prev]');
    var bNext = panel.querySelector('[data-next]');
    var picks = Array.prototype.slice.call(panel.querySelectorAll('.picker-row button'));
    var panelsOut = Array.prototype.slice.call(panel.querySelectorAll('.picker-panel'));
    var pickOut = panel.querySelector('.picker-out');
    var step = 1, focus = '';

    function applyLayers() {
      var layers = svg.querySelectorAll('.L');
      var shown = focus ? n : step;
      for (var i = 0; i < layers.length; i++) {
        var l = layers[i], sys = (l.getAttribute('data-system') || '').split(' ');
        l.classList.toggle('on', parseInt(l.getAttribute('data-from'), 10) <= shown);
        l.classList.toggle('is-focus', !!focus && sys.indexOf(focus) > -1);
      }
      svg.setAttribute('data-stage', String(shown));
      svg.setAttribute('data-stop', String(shown));
      if (focus) svg.setAttribute('data-focus', focus); else svg.removeAttribute('data-focus');
    }

    function render() {
      var li = items[step - 1];
      countEl.textContent = step + ' / ' + n;
      nameEl.textContent = li.querySelector('h3').textContent;
      capEl.innerHTML = li.querySelector('.hwb-cap').innerHTML;
      tagsEl.innerHTML = '';
      var fp = focus && panel.querySelector('.picker-panel[data-sys="' + focus + '"]');
      var tags = (fp || li).querySelectorAll('.hwb-tags li');
      for (var i = 0; i < tags.length; i++) tagsEl.appendChild(el('li', tags[i].textContent));
      bPrev.disabled = step <= 1;
      bNext.disabled = step >= n;
      applyLayers();
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

    // Swipe on touch and pen. The frame uses touch-action: pan-y, so vertical page scroll is untouched.
    var sx = 0, sy = 0, tracking = false;
    frame.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    });
    frame.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? step + 1 : step - 1);
    });
    frame.addEventListener('pointercancel', function () { tracking = false; });

    // Service picker (Building tab): show one system on its own by its SVG group class.
    picks.forEach(function (b) {
      b.addEventListener('click', function () {
        var sys = b.getAttribute('data-sys');
        if (focus === sys) { clearFocus(); render(); return; }
        focus = sys;
        picks.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        panelsOut.forEach(function (p) { p.hidden = p.getAttribute('data-sys') !== sys; });
        if (pickOut) pickOut.hidden = false;
        step = n;
        render();
      });
    });

    this.reset = function () { clearFocus(); step = 1; render(); };
    this.go = go;
    this.state = function () { return { step: step, focus: focus }; };
  }

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var viewers = {};
  tabs.forEach(function (t) {
    viewers[t.getAttribute('data-tab')] = new Viewer(document.getElementById(t.getAttribute('aria-controls')));
  });

  // Tabs. Switching to a tab always starts it at step 1.
  var current = '';
  function select(key, focusTab, updateHash) {
    if (!viewers[key]) key = 'building';
    var changed = key !== current;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focusTab) t.focus();
    });
    if (changed) { current = key; viewers[key].reset(); }
    // replaceState never scrolls and adds no history entry.
    if (updateHash && location.hash !== '#' + key && window.history && history.replaceState) history.replaceState(null, '', '#' + key);
  }
  function fromHash() { var h = location.hash.replace('#', ''); return viewers[h] ? h : 'building'; }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t.getAttribute('data-tab'), false, true); });
    t.addEventListener('keydown', function (ev) {
      var j = -1;
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
  select(fromHash(), false, false);
  window.__hwb = { state: function (k) { return viewers[k || current].state(); }, select: function (k) { select(k, false, true); }, go: function (k, s) { viewers[k].go(s); }, get tab() { return current; } };
})();
