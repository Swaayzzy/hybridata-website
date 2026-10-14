/* How We Build, Concept B: "How our MDFs are built". One generic, unbranded 42U four-post rack, built in code: no 3D asset file,
   no textures, no HDRI. Flat vector look: plain coloured faces, soft light, one blurred floor shadow.
   Every part belongs to a build step (1..8); `setState(step)` shows the parts up to that step and glides the camera.
   Render on demand: frames are drawn only while something moves.
   This file touches no DOM: it draws into the canvas it is given (a transferred OffscreenCanvas inside a worker, or a
   normal canvas on the page) and takes size and pointer input as calls. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CircleGeometry,
  PlaneGeometry, HemisphereLight, DirectionalLight, CanvasTexture, SRGBColorSpace, Color, Vector3, InstancedMesh, Object3D,
  TubeGeometry, CatmullRomCurve3, Sprite, SpriteMaterial
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ---------- the rack: from the top down, [kind, bottom unit, height in units, step it appears on] ---------- */
const U = 0.04445, Y0 = 0.1, RAIL = 0.4826, ZF = 0.375;   // 44.45 mm unit, floor to unit 1, 19 in rails, front face plane
const yc = (u, h) => Y0 + (u - 1) * U + (h * U) / 2;       // centre height of a device whose bottom unit is u
const LAYOUT = [
  ['fiber', 39, 4, 2],
  ['hm', 38, 1, 3], ['panel', 37, 1, 3], ['hm', 36, 1, 3], ['switch', 35, 1, 4],
  ['hm', 34, 1, 3], ['panel', 33, 1, 3], ['panel', 32, 1, 3], ['hm', 31, 1, 3], ['switch', 30, 1, 4],
  ['hm', 29, 1, 3], ['panel', 28, 1, 3], ['panel', 27, 1, 3], ['hm', 26, 1, 3], ['switch', 25, 1, 4],
  ['hm', 24, 1, 3], ['panel', 23, 1, 3], ['panel', 22, 1, 3], ['hm', 21, 1, 3], ['switch', 20, 1, 4],
  ['hm', 19, 1, 3], ['panel', 18, 1, 3],
  ['fw', 17, 1, 5], ['fw', 16, 1, 5], ['fw', 15, 1, 5],
  ['shelf', 13, 2, 5], ['shelf2', 7, 2, 5],
  ['ups', 5, 2, 6], ['ups', 3, 2, 6], ['ups', 1, 2, 6]
];

/* Field Ops RACK_COL */
const COL = { fiber: 0x7d55c7, hm: 0x39424c, panel: 0x2f6fb0, switch: 0x1f8a5b, fw: 0xa3424a, shelf: 0x59636d, ups: 0xb5651d };
const PORT_DARK = new Color(0x0a1218), PASS = new Color(0x4be08f), LED = new Color(0xb9ffd6), CORD = [0xe3b341, 0x6cc3ee, 0xe8eef0];

/* Camera poses: [target height, distance, azimuth deg, elevation deg] */
const POSE = {
  1: [1.04, 4.3, 26, 6], 2: [1.78, 2.35, 20, 8], 3: [1.5, 2.45, 16, 6], 4: [1.36, 2.4, -14, 4],
  5: [0.95, 2.45, -16, 6], 6: [0.5, 2.4, 14, 8], 7: [1.42, 2.3, 6, 3], 8: [1.04, 4.2, 20, 6]
};
const FOCUS_POSE = { fiber: [1.78, 2.35, 20, 8], cabling: [1.4, 2.5, 8, 4] };
const LIMIT = { az: [-100, 100], el: [-3, 52], dist: [1.1, 5.6] };

const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const raf = (f) => (self.requestAnimationFrame ? self.requestAnimationFrame(f) : setTimeout(() => f(performance.now()), 16));
const caf = (id) => (self.cancelAnimationFrame ? self.cancelAnimationFrame(id) : clearTimeout(id));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (t) => t * t * (3 - 2 * t);
const rad = (d) => (d * Math.PI) / 180;

export function create(canvas, options) {
  options = options || {};
  const phone = !!options.phone;
  const reduced = !!options.reduced;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!options.preserve, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  const maxDpr = phone ? 1.5 : 2;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 0.8, 0.2, 30);
  scene.add(new HemisphereLight(0xf2f7fa, 0x2c3a44, 2.1));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(1.6, 3.2, 3.4);
  scene.add(sun);

  /* ---------- materials, shared ---------- */
  const mats = {};
  const lam = (hex) => mats[hex] || (mats[hex] = new MeshLambertMaterial({ color: hex }));
  const portMat = new MeshBasicMaterial({ color: 0xffffff });
  const boxGeo = {};
  const box = (w, h, d) => { const k = w + ',' + h + ',' + d; return boxGeo[k] || (boxGeo[k] = new BoxGeometry(w, h, d)); };
  const put = (parent, w, h, d, hex, x, y, z) => { const m = new Mesh(box(w, h, d), lam(hex)); m.position.set(x, y, z); parent.add(m); return m; };
  const shade = (hex, k) => new Color(hex).multiplyScalar(k).getHex();

  /* instanced windows (ports, slots, LEDs) on one device: [x, y] centres on the faceplate, drawn just proud of it */
  const dummy = new Object3D();
  function windows(parent, pts, w, h, color, z, group) {
    const im = new InstancedMesh(box(w, h, 0.003), portMat, pts.length);
    for (let i = 0; i < pts.length; i++) {
      dummy.position.set(pts[i][0], pts[i][1], z);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, color);
    }
    im.instanceMatrix.needsUpdate = true;
    parent.add(im);
    if (group) group.push(im);
    return im;
  }
  const row = (n, pitch, x0, y) => Array.from({ length: n }, (_, i) => [x0 + i * pitch, y]);

  /* ---------- rack frame ---------- */
  const rack = new Group();
  scene.add(rack);
  const FRAME = 0x3d4a55, RAILC = 0x1f2a32;
  const top = Y0 + 42 * U;
  const H = top + 0.035;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(rack, 0.04, H, 0.04, FRAME, sx * 0.29, H / 2, sz * 0.395);
  for (const sx of [-1, 1]) {   // front 19 in mounting rails with hole marks
    put(rack, 0.026, 42 * U, 0.012, RAILC, sx * 0.2523, Y0 + 21 * U, ZF - 0.012);
    put(rack, 0.026, 42 * U, 0.012, RAILC, sx * 0.2523, Y0 + 21 * U, -ZF + 0.012);
  }
  const holes = [];
  for (let u = 0; u < 42; u++) for (const dy of [-0.0148, 0, 0.0148]) for (const sx of [-1, 1]) holes.push([sx * 0.2523, Y0 + u * U + U / 2 + dy]);
  windows(rack, holes, 0.009, 0.007, new Color(0x0a1015), ZF - 0.0055, null);
  for (const y of [0.085, top + 0.02]) {   // base and top frames
    put(rack, 0.6, 0.03, 0.04, FRAME, 0, y, ZF + 0.02); put(rack, 0.6, 0.03, 0.04, FRAME, 0, y, -ZF - 0.02);
    put(rack, 0.04, 0.03, 0.8, FRAME, -0.29, y, 0); put(rack, 0.04, 0.03, 0.8, FRAME, 0.29, y, 0);
  }
  put(rack, 0.58, 0.02, 0.8, 0x222d35, 0, 0.055, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(rack, 0.05, 0.04, 0.05, 0x151d23, sx * 0.28, 0.02, sz * 0.38);

  /* floor and the one soft shadow */
  const floor = new Mesh(new CircleGeometry(2.1, 72), new MeshBasicMaterial({ color: 0x15222a }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ring = new Mesh(new CircleGeometry(2.1, 72), new MeshBasicMaterial({ color: 0x1d2d37 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.002; ring.scale.set(1.04, 1.04, 1); scene.add(ring);
  const sc = mkCanvas(128, 128);
  const g2 = sc.getContext('2d'), rg = g2.createRadialGradient(64, 64, 6, 64, 64, 62);
  rg.addColorStop(0, 'rgba(0,0,0,.62)'); rg.addColorStop(.55, 'rgba(0,0,0,.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = rg; g2.fillRect(0, 0, 128, 128);
  const shTex = new CanvasTexture(sc); shTex.colorSpace = SRGBColorSpace;
  const shadow = new Mesh(new PlaneGeometry(1.7, 1.9), new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; scene.add(shadow);

  /* ---------- devices ---------- */
  const parts = [];            // {obj, step, t, goal}: build-in animation per top-level part
  const panelPorts = [];       // instanced port windows that go green when tested
  const info = { panels: [], switches: [], hms: [] };

  function device(kind, u, h, step) {
    const g = new Group();
    g.position.y = yc(u, h);
    const fh = h * U - 0.0036;
    const hex = kind === 'shelf2' ? COL.shelf : COL[kind === 'fw' ? 'fw' : kind];
    const fz = ZF + 0.002;
    const plate = (c) => put(g, RAIL, fh, 0.014, c == null ? hex : c, 0, 0, fz);
    const body = (d, w, hh, c) => put(g, w || RAIL - 0.04, hh || fh - 0.006, d, c == null ? shade(hex, 0.62) : c, 0, 0, fz - 0.007 - d / 2);
    const ZW = fz + 0.0085;   // window plane, just in front of the faceplate

    if (kind === 'panel') {
      plate(); body(0.07);
      panelPorts.push(windows(g, row(24, 0.0155, -0.3565 / 2, -0.001), 0.0112, 0.0108, PORT_DARK, ZW, null));
      put(g, RAIL - 0.02, 0.0016, 0.003, shade(hex, 1.28), 0, fh / 2 - 0.003, ZW);
      info.panels.push({ u, g, fh, labels: true });
    } else if (kind === 'switch') {
      plate(); body(0.36);
      windows(g, row(24, 0.0125, -0.221, 0.0105), 0.0092, 0.0088, PORT_DARK, ZW, null);
      windows(g, row(24, 0.0125, -0.221, -0.0105), 0.0092, 0.0088, PORT_DARK, ZW, null);
      windows(g, [[0.105, 0.0105], [0.132, 0.0105], [0.105, -0.0105], [0.132, -0.0105]], 0.019, 0.0095, PORT_DARK, ZW, null);
      windows(g, row(6, 0.009, 0.178, 0.0105), 0.0042, 0.0042, LED, ZW, null);
      windows(g, row(6, 0.009, 0.178, -0.0105), 0.0042, 0.0042, LED, ZW, null);
      info.switches.push({ u, g, fh });
    } else if (kind === 'hm') {
      plate(); body(0.09, null, null, 0x2c343c);
      windows(g, [[0, 0]], RAIL - 0.05, fh - 0.015, new Color(0x0a1015), ZW, null);   // dark duct
      const fingers = [];
      for (let i = 0; i < 13; i++) fingers.push([-0.216 + i * 0.036, 0]);
      const fm = new InstancedMesh(box(0.0075, fh - 0.006, 0.012), lam(shade(hex, 1.5)), fingers.length);
      fingers.forEach((p, i) => { dummy.position.set(p[0], 0, ZW + 0.004); dummy.updateMatrix(); fm.setMatrixAt(i, dummy.matrix); });
      g.add(fm);
      info.hms.push({ u, g, fh });
    } else if (kind === 'fiber') {
      plate(); body(0.3);
      put(g, RAIL - 0.04, fh - 0.026, 0.006, shade(hex, 1.32), 0, 0.004, ZW);   // sliding tray face
      const ap = [];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) ap.push([-0.165 + i * 0.03, 0.044 - r * 0.026]);
      windows(g, ap, 0.014, 0.012, new Color(0x1c1230), ZW + 0.004, null);
      put(g, 0.2, 0.012, 0.012, shade(hex, 0.45), 0, -fh / 2 + 0.022, ZW + 0.008);   // pull handle
    } else if (kind === 'fw') {
      plate(); body(0.34);
      windows(g, row(16, 0.0105, -0.225, 0), 0.0034, 0.0265, new Color(shade(hex, 0.45)), ZW, null);
      windows(g, row(6, 0.019, 0.04, -0.001), 0.0125, 0.0105, PORT_DARK, ZW, null);
      windows(g, row(4, 0.009, 0.17, 0.009), 0.0042, 0.0042, LED, ZW, null);
    } else if (kind === 'shelf' || kind === 'shelf2') {
      put(g, RAIL, 0.009, 0.46, hex, 0, -fh / 2 + 0.0045, fz - 0.22);                 // tray
      put(g, RAIL, 0.034, 0.008, shade(hex, 1.2), 0, -fh / 2 + 0.017, fz);            // front lip
      const gear = kind === 'shelf' ? [[-0.1, 0.17], [0.11, 0.17]] : [[0.0, 0.2]];
      gear.forEach((q) => {
        const gw = kind === 'shelf' ? 0.19 : 0.26;
        put(g, gw, 0.05, 0.24, shade(hex, 1.55), q[0], -fh / 2 + 0.009 + 0.025, fz - q[1]);
        windows(g, row(3, 0.013, q[0] - 0.02, -fh / 2 + 0.035), 0.0055, 0.0055, LED, fz - q[1] + 0.1215, null);
      });
    } else if (kind === 'ups') {
      plate(); body(0.55, RAIL - 0.06);
      windows(g, row(22, 0.0105, -0.225, 0), 0.0034, fh - 0.034, new Color(shade(hex, 0.5)), ZW, null);
      windows(g, [[0.17, 0.012]], 0.07, 0.026, new Color(0x0d1a20), ZW, null);
      windows(g, row(3, 0.02, 0.145, -0.024), 0.012, 0.009, new Color(shade(hex, 0.45)), ZW, null);
      windows(g, row(3, 0.009, 0.15, 0.012), 0.005, 0.005, LED, ZW + 0.002, null);
    }
    rack.add(g);
    parts.push({ obj: g, step, t: 0, goal: 0, base: g.position.y });
    return g;
  }
  LAYOUT.forEach((d) => device(d[0], d[1], d[2], d[3]));

  /* ---------- step 7: short patch cords through the horizontal managers, and labels ---------- */
  const labelsGroup = new Group();
  rack.add(labelsGroup);
  labelsGroup.visible = false;
  const cordPart = { step: 7, t: 0, goal: 0 };
  const cordMeshes = [];
  let cordsBuilt = false;
  function buildCords() {   // built on first need (a step ahead, or when idle): the cords are the costliest part of the scene
    if (cordsBuilt) return;
    cordsBuilt = true;
    const cordGeos = [[], [], []];
    const hmAt = (u) => info.hms.find((m) => m.u === u);
    const stubs = (px, py, z, dir, hmU, count, offset, colorStart) => {
      const hmY = yc(hmU, 1);
      for (let i = 0; i < count; i++) {
        const x = px(i), cx = Math.round((x + 0.216) / 0.036) * 0.036 - 0.216 + 0.018;   // gap between two fingers
        const pts = [
          new Vector3(x, py, z), new Vector3(x + (cx - x) * 0.2, py + dir * 0.012, z + 0.02),
          new Vector3(x + (cx - x) * 0.7, py + dir * 0.03, z + 0.024), new Vector3(cx, hmY - dir * 0.004, z + 0.012)
        ];
        cordGeos[(colorStart + i) % 3].push(new TubeGeometry(new CatmullRomCurve3(pts), 8, 0.0027, 5, false));
      }
    };
    const zc = ZF + 0.011;
    info.panels.forEach((p) => {
      const y = yc(p.u, 1);
      const above = hmAt(p.u + 1), below = hmAt(p.u - 1);
      const dir = above && !below ? 1 : -1;     // pairs: the upper panel goes up, the lower panel goes down
      const dirFix = above && below ? -1 : dir;
      stubs((i) => -0.1783 + (i * 3 + 1) * 0.0155, y + dirFix * 0.014, zc, dirFix, dirFix > 0 ? p.u + 1 : p.u - 1, 8, 0, p.u);
      // label strips above each block of six ports, and the panel's own tag
      for (let b = 0; b < 4; b++) put(labelsGroup, 0.074, 0.0042, 0.003, 0xeef4f5, -0.1783 + (b * 6 + 2.5) * 0.0155, y + (dirFix > 0 ? -1 : 1) * 0.0146, zc - 0.002);
    });
    info.switches.forEach((s) => {
      const y = yc(s.u, 1);
      stubs((i) => -0.221 + (i * 3 + 1) * 0.0125, y + 0.0105 + 0.006, zc, 1, s.u + 1, 8, 0, s.u + 1);
      stubs((i) => -0.221 + (i * 3 + 1) * 0.0125, y - 0.0105 - 0.006, zc, -1, s.u - 1, 8, 0, s.u);
      put(labelsGroup, 0.05, 0.0075, 0.003, 0xeef4f5, -0.222, y, zc);
    });
    cordGeos.forEach((list, i) => {
      const m = new Mesh(mergeGeometries(list), lam(CORD[i]));
      m.userData.total = m.geometry.index.count;
      m.visible = false;
      rack.add(m);
      cordMeshes.push(m);
    });
    info.hms.forEach((m) => {   // a small white tag at the left end of every manager and device too
      put(labelsGroup, 0.03, 0.0075, 0.003, 0xeef4f5, -0.232, yc(m.u, 1), zc);
    });

  }

  /* ---------- step 8: tested. Panel ports light green and a check badge pops up ---------- */
  const bc = mkCanvas(256, 256);
  const b2 = bc.getContext('2d');
  b2.fillStyle = '#1f8a5b'; b2.beginPath(); b2.arc(128, 128, 118, 0, 7); b2.fill();
  b2.lineWidth = 12; b2.strokeStyle = '#d8ffe9'; b2.beginPath(); b2.arc(128, 128, 118, 0, 7); b2.stroke();
  b2.lineWidth = 26; b2.lineCap = 'round'; b2.lineJoin = 'round'; b2.strokeStyle = '#ffffff';
  b2.beginPath(); b2.moveTo(72, 134); b2.lineTo(111, 172); b2.lineTo(186, 88); b2.stroke();
  const bTex = new CanvasTexture(bc); bTex.colorSpace = SRGBColorSpace;
  const badge = new Sprite(new SpriteMaterial({ map: bTex, transparent: true, depthTest: false }));
  badge.position.set(0.52, 1.52, 0.5); badge.scale.setScalar(0.0001); badge.renderOrder = 10;
  scene.add(badge);
  const testPart = { step: 8, t: 0, goal: 0 };
  const colorPorts = (pass) => {
    panelPorts.forEach((im) => {
      for (let i = 0; i < im.count; i++) im.setColorAt(i, pass ? PASS : PORT_DARK);
      im.instanceColor.needsUpdate = true;
    });
  };

  /* ---------- camera: spherical orbit around the rack's centre line, clamped; glides between poses ---------- */
  const cam = { ty: POSE[1][0], dist: POSE[1][1], az: POSE[1][2], el: POSE[1][3] };
  const goal = { ty: cam.ty, dist: cam.dist, az: cam.az, el: cam.el };
  function place() {
    const el = Math.max(cam.el, Math.asin(clamp((0.14 - cam.ty) / cam.dist, -1, 1)) * 180 / Math.PI);   // never below the floor
    const a = rad(cam.az), e = rad(el);
    camera.position.set(Math.sin(a) * Math.cos(e) * cam.dist, cam.ty + Math.sin(e) * cam.dist, Math.cos(a) * Math.cos(e) * cam.dist);
    camera.lookAt(0, cam.ty, 0);
  }

  let step = 1, rafId = 0, last = 0, size = [0, 0], dpr = 1, alive = true, drag = 0;
  const SPEED = 5.2;   // 1/s: the glide settles in about a second
  function setSize(w, h, ratio) {
    ratio = Math.min(ratio || 1, maxDpr);
    if (!w || !h || (w === size[0] && h === size[1] && ratio === dpr)) return;
    size = [w, h]; dpr = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake();
  }
  function applyParts() {
    parts.forEach((p) => {
      const t = ease(p.t);
      p.obj.visible = p.t > 0.001;
      p.obj.position.y = p.base;
      p.obj.position.z = (1 - t) * 0.45;
    });
    const ct = ease(cordPart.t);
    cordMeshes.forEach((m) => { m.visible = ct > 0.001; m.geometry.setDrawRange(0, Math.floor((m.userData.total * ct) / 3) * 3); });
    labelsGroup.visible = cordPart.t > 0.98;
    const bt = ease(testPart.t);
    badge.scale.setScalar(0.0001 + bt * cam.dist * 0.082);   // constant size on screen
    badge.visible = bt > 0.001;
  }
  function frameTick(now) {
    rafId = 0;
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    const k = reduced ? 1 : 1 - Math.exp(-SPEED * dt);
    if (!drag) {
      for (const key of ['ty', 'dist', 'az', 'el']) {
        const d = goal[key] - cam[key];
        if (Math.abs(d) > 0.0008) { cam[key] += d * k; moving = true; } else cam[key] = goal[key];
      }
    } else moving = true;
    const all = parts.concat([cordPart, testPart]);
    for (const p of all) {
      const want = p.step <= step ? 1 : 0;
      if (p.goal !== want) p.goal = want;
      const d = p.goal - p.t;
      if (Math.abs(d) > 0.002) { p.t = reduced ? p.goal : p.t + clamp(d, -dt * 3.2, dt * 3.2); moving = true; } else p.t = p.goal;
    }
    applyParts();
    place();
    renderer.render(scene, camera);
    if (moving && alive) rafId = raf(frameTick);
  }
  function wake() { if (!rafId && alive) { last = performance.now(); rafId = raf(frameTick); } }

  function setState(n, focus) {
    step = clamp(n | 0, 1, 8);
    const p = (focus && FOCUS_POSE[focus]) || POSE[step];
    goal.ty = p[0]; goal.dist = p[1]; goal.az = p[2]; goal.el = p[3];
    colorPorts(step >= 8);
    if (step >= 6) buildCords();
    wake();
  }

  /* ---------- orbit: drag to rotate, two fingers to pinch. Input arrives as calls (the page forwards its pointer events) ---------- */
  const ptrs = new Map();
  let pinch = 0;
  function stopGlide() { goal.ty = cam.ty; goal.dist = cam.dist; goal.az = cam.az; goal.el = cam.el; }
  function pointer(kind, id, x, y) {
    if (kind === 'down') {
      ptrs.set(id, [x, y]);
      if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); }
      stopGlide(); drag = 1; wake();
    } else if (kind === 'move') {
      const p = ptrs.get(id);
      if (!p) return;
      const dx = x - p[0], dy = y - p[1];
      p[0] = x; p[1] = y;
      if (ptrs.size >= 2) {
        const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
        if (pinch > 0 && d > 0) cam.dist = clamp(cam.dist * (pinch / d), LIMIT.dist[0], LIMIT.dist[1]);
        pinch = d;
      } else {
        cam.az = clamp(cam.az - dx * 0.35, LIMIT.az[0], LIMIT.az[1]);
        cam.el = clamp(cam.el + dy * 0.25, LIMIT.el[0], LIMIT.el[1]);
      }
      stopGlide(); wake();
    } else {
      ptrs.delete(id);
      if (ptrs.size < 2) pinch = 0;
      if (!ptrs.size) { drag = 0; stopGlide(); }
      wake();
    }
  }
  function wheel(deltaY) {   // trackpad pinch (the page only forwards ctrl + wheel; a plain wheel keeps scrolling the page)
    cam.dist = clamp(cam.dist * Math.exp(deltaY * 0.01), LIMIT.dist[0], LIMIT.dist[1]);
    stopGlide(); wake();
  }

  setSize(options.width, options.height, options.dpr);
  setState(options.step || 1, options.focus);
  // First paint without the glide: start parked on the first pose
  Object.assign(cam, goal);
  parts.forEach((p) => { p.t = p.goal = p.step <= step ? 1 : 0; });
  cordPart.t = cordPart.goal = cordPart.step <= step ? 1 : 0;
  testPart.t = testPart.goal = testPart.step <= step ? 1 : 0;
  applyParts(); place(); renderer.render(scene, camera);
  if (step < 6) setTimeout(buildCords, 2500);

  return {
    setState, setSize, pointer, wheel,
    /* test hooks: jump the camera (az/el degrees, dist metres, ty metres) and redraw */
    pose: (p) => { Object.assign(cam, p); Object.assign(goal, p); place(); renderer.render(scene, camera); return Object.assign({}, cam); },
    layout: LAYOUT,
    dispose() {
      alive = false; if (rafId) caf(rafId);
      renderer.dispose();
    }
  };
}
