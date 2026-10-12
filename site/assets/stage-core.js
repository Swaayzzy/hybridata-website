/* Shared helpers for the two 3D sections: mode detection, 2D/3D toggle,
   label layer with a bounding-box overlap check, and the lazy loader stub for the 3D bundle. */
(function () {
  'use strict';
  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Lazy-loader stub. When a 3D bundle ships, add its file name here, e.g. BUNDLES.home = 'home-building.3d.js'.
  // The file lives in assets/3d/ and must export mount(el, options) -> { destroy() }. See assets/3d/README.md.
  var BUNDLES = { home: 'home-building.3d.js', rack: 'rack.3d.js' };
  var BUNDLE_BASE = 'assets/3d/';

  function reduceMotion() { return mqReduce.matches; }

  function webglOk() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  // Returns why the simple 2D view must be used, or '' when 3D would be allowed.
  function force2DReason() {
    var conn = navigator.connection || {};
    var mode = /[?&]mode=(2d|3d)\b/.exec(location.search);
    if (mode && mode[1] === '2d') return 'simple view requested';
    if (reduceMotion()) return 'reduced motion';
    if (conn.saveData) return 'Save-Data';
    // ?mode=3d (testing only) skips the size and hardware checks, never the motion, data or WebGL checks. ?eager=1 mounts at once.
    if (!mode) {
      if (window.innerWidth <= 360) return 'narrow screen';
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'low-memory device';
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return 'low-power device';
    }
    if (!webglOk()) return 'no WebGL';
    return '';
  }

  function setHeaderVar() {
    var h = document.querySelector('.site-header');
    if (h) root.style.setProperty('--hdr', Math.round(h.getBoundingClientRect().height) + 'px');
  }

  function load3D(name, mountEl, options) {
    if (!BUNDLES[name]) return Promise.resolve(null);
    return import(new URL(BUNDLE_BASE + BUNDLES[name], document.baseURI).href).then(function (m) {
      return m.mount(mountEl, options || {});
    });
  }

  // Simple view <-> 3D view toggle. 3D is disabled until a bundle is registered for `name`.
  function initToggle(section, name) {
    var btn2d = section.querySelector('[data-view="2d"]');
    var btn3d = section.querySelector('[data-view="3d"]');
    var note = section.querySelector('.view-note');
    var mount = section.querySelector('[data-3d-mount]');
    var reason = force2DReason();
    var has3D = !!BUNDLES[name];
    var current = '2d', handle = null, listeners = [];
    section.dataset.view = '2d'; root.setAttribute('data-tier', '2d');
    section.dataset.modeReason = reason || (has3D ? '' : '3D bundle not installed');
    if (btn2d) btn2d.setAttribute('aria-pressed', 'true');
    if (btn3d) {
      btn3d.setAttribute('aria-pressed', 'false');
      if (!has3D || reason) btn3d.setAttribute('aria-disabled', 'true');
    }
    if (note) {
      if (reason) note.textContent = 'Simple view is on (' + reason + ').';
      else if (!has3D) note.textContent = '3D view is not installed on this build yet.';
    }
    var loading = false;
    function set(view) {
      if (view === '3d') {
        if (!has3D || reason) return;
        if (loading) return;
        loading = true; btn3d.setAttribute('aria-busy', 'true');
        mount.hidden = false;
        load3D(name, mount, { reduceMotion: reduceMotion() }).then(function (h) {
          loading = false; btn3d.removeAttribute('aria-busy');
          if (!h) { mount.hidden = true; return; }
          handle = h; current = '3d'; section.dataset.view = '3d'; root.setAttribute('data-tier', '3d');
          btn2d.setAttribute('aria-pressed', 'false'); btn3d.setAttribute('aria-pressed', 'true');
          listeners.forEach(function (fn) { fn('3d', handle); });
        }).catch(function () {
          loading = false; btn3d.removeAttribute('aria-busy'); mount.hidden = true;
          if (note) note.textContent = '3D view could not load. Simple view is on.';
        });
      } else {
        current = '2d'; section.dataset.view = '2d'; root.setAttribute('data-tier', '2d');
        if (handle && handle.destroy) { handle.destroy(); handle = null; }
        if (mount) mount.hidden = true;
        listeners.forEach(function (fn) { fn('2d', null); });
        if (btn2d) btn2d.setAttribute('aria-pressed', 'true');
        if (btn3d) btn3d.setAttribute('aria-pressed', 'false');
      }
    }
    if (btn2d) btn2d.addEventListener('click', function () { set('2d'); });
    if (btn3d) btn3d.addEventListener('click', function () { set('3d'); });
    return { get view() { return current; }, get handle() { return handle; }, set: set, onChange: function (fn) { listeners.push(fn); } };
  }

  // Show every layer whose data-from <= stage; mark layers of the focused system.
  function applyStage(svg, stage, focus) {
    var layers = svg.querySelectorAll('.L');
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      var from = parseInt(el.getAttribute('data-from'), 10);
      el.classList.toggle('on', from <= stage);
      var sys = (el.getAttribute('data-system') || '').split(' ');
      el.classList.toggle('is-focus', !!focus && sys.indexOf(focus) > -1);
    }
  }

  function overlap(a, b, pad) {
    pad = pad || 0;
    return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  }

  /* Label layer. opts: { frame, vb:{w,h}, draw:{x,y,w,h} (model area in viewBox units), mode:'tb'|'lr', max:3 }.
     Labels sit in the free bands around the model (top/bottom or left/right), never over it.
     Placement tries slots until a label overlaps neither another label nor the model; if none fits, it is dropped.
     check() re-measures the DOM and reports labels, overlaps, and labels touching the model. */
  function createLabels(opts) {
    var frame = opts.frame, max = opts.max || 3;
    var layer = document.createElement('div'); layer.className = 'stage-labels'; layer.setAttribute('aria-hidden', 'true');
    var NS = 'http://www.w3.org/2000/svg';
    var leaders = document.createElementNS(NS, 'svg'); leaders.setAttribute('class', 'stage-leaders'); leaders.setAttribute('aria-hidden', 'true');
    frame.appendChild(leaders); frame.appendChild(layer);
    var current = [];

    function geom() {
      var W = frame.clientWidth, H = frame.clientHeight;
      var s = Math.min(W / opts.vb.w, H / opts.vb.h);
      var ox = (W - opts.vb.w * s) / 2, oy = (H - opts.vb.h * s) / 2;
      var d = opts.draw;
      return {
        W: W, H: H,
        pt: function (x, y) { return { x: ox + x * s, y: oy + y * s }; },
        draw: { left: ox + d.x * s, top: oy + d.y * s, right: ox + (d.x + d.w) * s, bottom: oy + (d.y + d.h) * s }
      };
    }

    function layout() {
      var g = geom(), placed = [], k;
      leaders.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
      while (leaders.firstChild) leaders.removeChild(leaders.firstChild);
      for (k = 0; k < current.length; k++) {
        var it = current[k], el = it.el, a = g.pt(it.ax, it.ay);
        el.style.maxWidth = Math.max(60, (opts.mode === 'lr' ? Math.max(g.draw.left, g.W - g.draw.right) : g.W * 0.46) - 12) + 'px';
        var w = el.offsetWidth, h = el.offsetHeight, cands = [], j, x, y;
        if (opts.mode === 'lr') {
          var xsLR = [6, g.W - w - 6];
          for (var si = 0; si < 2; si++) {
            for (y = 6; y <= g.H - h - 6; y += 8) cands.push({ x: xsLR[si], y: y });
          }
        } else {
          for (y = 6; y <= g.H - h - 6; y += 6) {
            if (y + h > g.draw.top - 2 && y < g.draw.bottom + 2) continue; // skip rows inside the model band
            for (x = 6; x <= g.W - w - 6; x += 8) cands.push({ x: x, y: y });
          }
        }
        // nearest slot to the anchor first, so leader lines stay short
        for (j = 0; j < cands.length; j++) {
          var cx = Math.max(cands[j].x, Math.min(a.x, cands[j].x + w)), cy = Math.max(cands[j].y, Math.min(a.y, cands[j].y + h));
          cands[j].d = Math.hypot(cx - a.x, cy - a.y);
        }
        cands.sort(function (m, n) { return m.d - n.d; });
        var chosen = null;
        for (j = 0; j < cands.length && !chosen; j++) {
          var r = { left: cands[j].x, top: cands[j].y, right: cands[j].x + w, bottom: cands[j].y + h };
          var bad = overlap(r, g.draw, 2);
          for (var p = 0; p < placed.length && !bad; p++) bad = overlap(r, placed[p], 4);
          if (!bad) chosen = r;
        }
        if (!chosen) { el.hidden = true; it.rect = null; continue; }
        el.hidden = false;
        el.style.left = chosen.left + 'px'; el.style.top = chosen.top + 'px';
        placed.push(chosen); it.rect = chosen;
        var ex = Math.abs(a.x - chosen.left) < Math.abs(a.x - chosen.right) ? chosen.left : chosen.right;
        if (opts.mode !== 'lr') ex = Math.max(chosen.left + 4, Math.min(chosen.right - 4, a.x));
        var ey = opts.mode === 'lr' ? (chosen.top + chosen.bottom) / 2 : (chosen.top < g.H / 2 ? chosen.bottom : chosen.top);
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', ex); ln.setAttribute('y1', ey); ln.setAttribute('x2', a.x); ln.setAttribute('y2', a.y);
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', a.x); dot.setAttribute('cy', a.y); dot.setAttribute('r', 3);
        leaders.appendChild(ln); leaders.appendChild(dot);
      }
    }

    function show(list) {
      var i;
      for (i = 0; i < current.length; i++) layer.removeChild(current[i].el);
      current = [];
      list = (list || []).slice(0, max);
      for (i = 0; i < list.length; i++) {
        var el = document.createElement('div');
        el.className = 'stage-label' + (opts.mode === 'lr' ? ' is-lr' : '');
        el.textContent = list[i].text;
        layer.appendChild(el);
        current.push({ el: el, ax: list[i].ax, ay: list[i].ay });
      }
      layout();
      for (i = 0; i < current.length; i++) current[i].el.classList.add('is-on');
    }

    function check() {
      var g = geom(), fr = frame.getBoundingClientRect(), vis = [], i, j, over = 0, onModel = 0;
      for (i = 0; i < current.length; i++) if (!current[i].el.hidden) vis.push(current[i].el.getBoundingClientRect());
      var model = { left: fr.left + g.draw.left, top: fr.top + g.draw.top, right: fr.left + g.draw.right, bottom: fr.top + g.draw.bottom };
      for (i = 0; i < vis.length; i++) {
        if (overlap(vis[i], model, 0)) onModel++;
        for (j = i + 1; j < vis.length; j++) if (overlap(vis[i], vis[j], 0)) over++;
      }
      return { labels: vis.length, overlaps: over, onModel: onModel, ok: vis.length <= max && over === 0 && onModel === 0 };
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) ro.observe(frame);
    return { show: show, layout: layout, check: check };
  }

  setHeaderVar();
  window.addEventListener('resize', setHeaderVar);
  window.HybStage = {
    BUNDLES: BUNDLES, reduceMotion: reduceMotion, force2DReason: force2DReason, load3D: load3D,
    initToggle: initToggle, applyStage: applyStage, createLabels: createLabels
  };
})();
