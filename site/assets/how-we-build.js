/* How We Build: tabs (Building / Data Center Rack) and the autoplay step player.
   Art goes in through the SVG groups (.L[data-from][data-system]); this file never touches the drawing itself. */
(function () {
  'use strict';
  var root = document.getElementById('how-we-build');
  if (!root) return;
  var STEP_MS = 4000;       // dwell per step
  var START_RATIO = 0.6;    // autoplay runs only while at least 60% of the stage is on screen
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function icon(kind) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', {
      play: 'M8 5v14l11-7z',
      pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
      replay: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
      prev: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
      next: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z'
    }[kind]);
    s.appendChild(p);
    return s;
  }
  function button(cls, kind, label, text) {
    var b = el('button', cls); b.type = 'button';
    b.appendChild(icon(kind));
    if (text) b.appendChild(el('span', 'hwb-btn-t', text));
    b.setAttribute('aria-label', label);
    return b;
  }

  function Player(panel) {
    var self = this;
    var frame = panel.querySelector('[data-frame]');
    var svg = panel.querySelector('svg[data-art]');
    var items = Array.prototype.slice.call(panel.querySelectorAll('.hwb-steps > li'));
    var n = items.length;
    var numEl = panel.querySelector('[data-num]');
    var nameEl = panel.querySelector('[data-name]');
    var capEl = panel.querySelector('[data-caption]');
    var tagsEl = panel.querySelector('[data-tags]');
    var ctrl = panel.querySelector('[data-controls]');
    var picks = Array.prototype.slice.call(panel.querySelectorAll('.picker-row button'));
    var panelsOut = Array.prototype.slice.call(panel.querySelectorAll('.picker-panel'));
    var hint = panel.querySelector('.picker-hint');

    var step = 1, elapsed = 0, last = 0, raf = 0;
    var wantPlay = false, finished = false, focus = '';
    var onScreen = false, tabOn = false;

    // controls
    var bar = el('div', 'hwb-progress'); bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Progress'); bar.setAttribute('aria-valuemin', '1'); bar.setAttribute('aria-valuemax', String(n));
    var fill = el('div', 'hwb-progress-fill'); bar.appendChild(fill);
    var row = el('div', 'hwb-btns');
    var bPlay = button('hwb-btn hwb-play', 'play', 'Play', 'Play');
    var bReplay = button('hwb-btn hwb-replay', 'replay', 'Replay from step 1', 'Replay');
    var bPrev = button('hwb-btn hwb-prev', 'prev', 'Previous step');
    var bNext = button('hwb-btn hwb-next', 'next', 'Next step');
    row.appendChild(bPlay); row.appendChild(bReplay); row.appendChild(bPrev); row.appendChild(bNext);
    var dots = el('div', 'hwb-dots'); dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', 'Steps');
    var dotEls = items.map(function (li, i) {
      var d = el('button', 'hwb-dot'); d.type = 'button';
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + n + ': ' + li.querySelector('h3').textContent);
      d.appendChild(el('span', 'hwb-dot-i', String(i + 1)));
      d.addEventListener('click', function () { go(i + 1, true); });
      dots.appendChild(d);
      return d;
    });
    ctrl.appendChild(bar); ctrl.appendChild(row); ctrl.appendChild(dots);

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

    function render(byUser) {
      var li = items[step - 1];
      // Announce only when the visitor acted; autoplay ticks stay silent.
      capEl.setAttribute('aria-live', byUser ? 'polite' : 'off');
      numEl.textContent = li.querySelector('.hwb-step-n').textContent;
      nameEl.textContent = li.querySelector('h3').textContent;
      capEl.innerHTML = li.querySelector('.hwb-cap').innerHTML;
      tagsEl.innerHTML = '';
      var fp = focus && panel.querySelector('.picker-panel[data-sys="' + focus + '"]');
      var tags = (fp || li).querySelectorAll('.hwb-tags li');
      for (var i = 0; i < tags.length; i++) tagsEl.appendChild(el('li', '', tags[i].textContent));
      dotEls.forEach(function (d, i) {
        if (i + 1 === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
        d.classList.toggle('is-done', i + 1 < step);
      });
      bPrev.disabled = step <= 1;
      bNext.disabled = step >= n;
      bar.setAttribute('aria-valuenow', String(step));
      bar.setAttribute('aria-valuetext', 'Step ' + step + ' of ' + n);
      applyLayers();
      paintProgress();
    }

    function paintProgress() {
      var p = finished ? 1 : (step - 1 + Math.min(1, elapsed / STEP_MS)) / n;
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }

    function isRunning() {
      return wantPlay && onScreen && tabOn && !document.hidden && !focus;
    }

    function tick(now) {
      raf = 0;
      if (!isRunning()) return;
      elapsed += now - last; last = now;
      if (elapsed >= STEP_MS) {
        if (step < n) { step += 1; elapsed = 0; render(false); }
        else { finished = true; wantPlay = false; elapsed = 0; render(false); sync(); return; }
      }
      paintProgress();
      raf = requestAnimationFrame(tick);
    }

    // Single place that reconciles state with the clock, the button label and the CSS animation state.
    function sync() {
      var run = isRunning();
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
      panel.classList.toggle('is-paused', !run);
      var label = wantPlay ? 'Pause' : 'Play';
      bPlay.setAttribute('aria-label', label);
      bPlay.querySelector('.hwb-btn-t').textContent = label;
      bPlay.replaceChild(icon(wantPlay ? 'pause' : 'play'), bPlay.querySelector('svg'));
    }

    function go(k, byUser) {
      step = Math.max(1, Math.min(n, k)); elapsed = 0; finished = false;
      if (byUser && focus) clearFocus(false);
      render(byUser);
      sync();
    }

    function toggle() {
      if (wantPlay) { wantPlay = false; }
      else {
        if (finished || focus) { if (focus) clearFocus(false); step = 1; elapsed = 0; finished = false; render(true); }
        wantPlay = true;
      }
      sync();
    }

    bPlay.addEventListener('click', toggle);
    bReplay.addEventListener('click', function () { if (focus) clearFocus(false); step = 1; elapsed = 0; finished = false; wantPlay = true; render(true); sync(); });
    bPrev.addEventListener('click', function () { go(step - 1, true); });
    bNext.addEventListener('click', function () { go(step + 1, true); });
    // Tapping the stage pauses; tapping again resumes from the same step. With reduced motion the stage never starts playback.
    frame.addEventListener('click', function () {
      if (finished || focus) return;
      if (!wantPlay && mqReduce.matches) return;
      toggle();
    });

    // Service picker (Building tab): isolate one system by its SVG group class.
    function clearFocus(redraw) {
      focus = '';
      picks.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      panelsOut.forEach(function (p) { p.hidden = true; });
      if (hint) hint.hidden = false;
      if (redraw !== false) { render(true); sync(); }
    }
    picks.forEach(function (b) {
      b.addEventListener('click', function () {
        var sys = b.getAttribute('data-sys');
        if (focus === sys) { clearFocus(); return; }
        focus = sys; wantPlay = false; finished = true;
        picks.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        panelsOut.forEach(function (p) { p.hidden = p.getAttribute('data-sys') !== sys; });
        if (hint) hint.hidden = true;
        step = n; elapsed = 0;
        render(true); sync();
      });
    });

    // Public API
    self.setOnScreen = function (v) { onScreen = v; sync(); };
    self.sync = sync;
    self.activate = function () {
      tabOn = true; focus = ''; clearFocus(false);
      // Each visit starts from a blank stage so step 1 draws in (LIGHT-503: the art is animated by CSS transitions).
      var lit = svg.querySelectorAll('.L.on');
      for (var k = 0; k < lit.length; k++) lit[k].classList.remove('on');
      void svg.getBoundingClientRect();
      step = 1; elapsed = 0; finished = false;
      wantPlay = !mqReduce.matches;   // reduced motion: opens on step 1, no auto-advance
      render(false); sync();
    };
    self.deactivate = function () { tabOn = false; wantPlay = false; sync(); };
    self.reduceChanged = function () { if (mqReduce.matches) { wantPlay = false; } sync(); };
    self.frame = frame;
    self.state = function () { return { step: step, elapsed: Math.round(elapsed), wantPlay: wantPlay, running: isRunning(), finished: finished, focus: focus, onScreen: onScreen }; };
    self.go = function (k) { go(k, true); };
  }

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var players = {};
  tabs.forEach(function (t) {
    var key = t.getAttribute('data-tab');
    players[key] = new Player(document.getElementById(t.getAttribute('aria-controls')));
  });

  // One observer for every stage frame; a hidden tab's frame reports 0.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        Object.keys(players).forEach(function (k) {
          if (players[k].frame === e.target) players[k].setOnScreen(e.intersectionRatio >= START_RATIO);
        });
      });
    }, { threshold: [0, START_RATIO] });
    Object.keys(players).forEach(function (k) { io.observe(players[k].frame); });
  }
  document.addEventListener('visibilitychange', function () { Object.keys(players).forEach(function (k) { players[k].sync(); }); });
  var onReduce = function () { Object.keys(players).forEach(function (k) { players[k].reduceChanged(); }); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce); else if (mqReduce.addListener) mqReduce.addListener(onReduce);

  // Tabs
  var current = '';
  function select(key, focusTab, updateHash) {
    if (!players[key]) key = 'building';
    var changed = key !== current;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focusTab) t.focus();
    });
    if (changed) {
      if (current) players[current].deactivate();
      current = key;
      players[key].activate();
    }
    // replaceState never scrolls and adds no history entry.
    if (updateHash && location.hash !== '#' + key && window.history && history.replaceState) history.replaceState(null, '', '#' + key);
  }
  function fromHash() { var h = location.hash.replace('#', ''); return players[h] ? h : 'building'; }

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
  window.__hwb = { state: function (k) { return players[k || current].state(); }, select: function (k) { select(k, false, true); }, go: function (k, s) { players[k].go(s); }, get tab() { return current; } };
})();
