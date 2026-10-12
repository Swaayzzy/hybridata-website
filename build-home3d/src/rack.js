/* Data center "Build the rack": one generic, unbranded 42U four-post rack under an overhead ladder rack, built in code.
   PBR textures (ambientCG, CC0), one HDRI (Poly Haven, CC0). One continuous build value `p` (1..6) drives every part,
   so the slider is reversible and always settles on a clean stop. Render on demand: frames are drawn only while p is moving. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, DirectionalLight,
  TextureLoader, SRGBColorSpace, RepeatWrapping, EquirectangularReflectionMapping, PMREMGenerator, ACESFilmicToneMapping,
  Color, Vector3, Matrix4, CanvasTexture, LinearMipmapLinearFilter, PCFShadowMap, CircleGeometry, BoxGeometry,
  CylinderGeometry, SphereGeometry, HemisphereLight, InstancedMesh, AdditiveBlending, DoubleSide, PlaneGeometry
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Part, V, T, mat, boxGeo, tubeGeo, tintGeo } from './util.js';

const HOME = new URL('home/', import.meta.url).href;   // shared with the home bundle: HDRI, Metal027, PaintedMetal004, Concrete034
const RACK = new URL('rack/', import.meta.url).href;   // Plastic010, Rubber004

const U = 0.04445, Y0 = 0.14, ZF = 0.43, RW = 0.4826;
const yU = (u, h) => Y0 + (u - 1) * U + ((h || 1) * U) / 2;   // centre of a device whose bottom is rack unit u
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/* Layout from the top, in rack units: [kind, bottom unit, height] */
const LAYOUT = [
  ['fiber', 41, 2], ['hm', 40, 1], ['panel', 39, 1], ['hm', 38, 1], ['switch', 37, 1], ['hm', 36, 1],
  ['panel', 35, 1], ['hm', 34, 1], ['switch', 33, 1], ['hm', 32, 1], ['panel', 30, 2], ['hm', 29, 1], ['switch', 28, 1],
  ['hm', 27, 1], ['panel', 26, 1], ['hm', 25, 1], ['switch', 24, 1]
];
const PAIRS = [[39, 37, -1], [35, 33, 1], [30, 28, -1], [26, 24, 1]];   // [panel unit, switch unit, which vertical manager]
const POSE = [   // per stop: camera yaw (rad), look-at x, half width kept in frame (m)
  null, [0.32, 0, 1.0], [0.28, 0, 1.0], [0.24, 0, 1.0], [0.2, 0, 1.0], [0.15, 0, 1.0], [0.1, 0, 1.0]
];
const TABLET = { x: 0.4, y: 0.82, z: 0.8 };
const MODEL_X = 0.6, MODEL_Y0 = 0.0, MODEL_Y1 = 2.45;

const yieldMain = () => new Promise((r) => setTimeout(r, 0));

export async function mount(el, options) {
  options = options || {};
  const frame = el.parentElement;
  const phone = Math.min(window.innerWidth, window.innerHeight) <= 820 || matchMedia('(pointer: coarse)').matches;
  const tier = phone ? 's' : 'm';
  const maxDpr = phone ? 1 : 1.5;

  /* ---------- renderer, scene, camera, the one shadow ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-3d-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 0.7, 0.3, 40);
  const sun = new DirectionalLight(0xfff1de, 2.3);
  sun.position.set(2.2, 4.2, 3.4); sun.target.position.set(0, 1.1, 0);
  sun.castShadow = true;   // the only shadow in the scene
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -2.2; sc.right = 2.2; sc.top = 2.8; sc.bottom = -0.6; sc.near = 1; sc.far = 12;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, new HemisphereLight(0xdfeaf2, 0x232a30, 0.9));

  const tStart = performance.now();
  let running = false, onscreen = true, lastT = 0, frames = 0, destroyed = false, sized = false;
  let pending = 0, onAllLoaded = null, loadedErr = 0;
  const snap = !!options.reduceMotion;

  /* ---------- textures and materials ---------- */
  const loader = new TextureLoader();
  const texCache = {};
  function done() { pending--; invalidate(); if (pending === 0 && onAllLoaded) onAllLoaded(); }
  function tex(base, set, kind) {
    const key = base + set + kind;
    if (texCache[key]) return texCache[key];
    pending++;
    const t = loader.load(base + 'tex' + tier + '/' + set + '_' + kind + '.webp', done, undefined, () => { loadedErr++; done(); });
    t.wrapS = t.wrapT = RepeatWrapping;
    if (kind === 'Color') t.colorSpace = SRGBColorSpace;
    t.anisotropy = phone ? 2 : 6;
    texCache[key] = t;
    return t;
  }
  function pbr(base, set, o) {
    o = o || {};
    const m = new MeshStandardMaterial({
      color: 0xffffff, map: tex(base, set, 'Color'), normalMap: tex(base, set, 'NormalGL'), roughnessMap: tex(base, set, 'Roughness'),
      roughness: o.rough === undefined ? 1 : o.rough, metalness: o.metal || 0, vertexColors: !!o.vc
    });
    if (o.metalMap) { m.metalnessMap = tex(base, set, 'Metalness'); m.metalness = o.metal === undefined ? 1 : o.metal; }
    if (o.normal !== undefined) m.normalScale.set(o.normal, o.normal);
    return m;
  }
  const hw = (metal, rough) => new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: metal, roughness: rough });
  const B = {
    paint: pbr(HOME, 'PaintedMetal004', { vc: true, metal: 0.7, metalMap: true, rough: 0.8, normal: 0.6 }),
    steel: pbr(HOME, 'Metal027', { vc: true, metal: 0.35, metalMap: false, rough: 0.7 }),
    plastic: pbr(RACK, 'Plastic010', { vc: true, rough: 0.9 }),
    rubber: pbr(RACK, 'Rubber004', { vc: true, rough: 1, normal: 0.7 }),
    hwMetal: hw(0.6, 0.45), hwPlastic: hw(0, 0.5)
  };
  const M = {
    rail: T(B.plastic, 0x23282d), frame: T(B.plastic, 0x3a4249), shelf: T(B.plastic, 0x4a545c),
    steel: T(B.steel, 0xffffff), galv: T(B.steel, 0xffffff),
    face: T(B.plastic, 0x262c31), faceLight: T(B.steel, 0xaab2b8), mgr: T(B.plastic, 0x4d5862),
    sock: T(B.hwPlastic, 0x6b7680), socketDark: T(B.hwPlastic, 0x07090a), white: T(B.hwPlastic, 0xe9edef),
    aqua: T(B.hwPlastic, 0x2bb7c9), copper: T(B.hwMetal, 0xb87333), brass: T(B.hwMetal, 0xc8a24a), silver: T(B.hwMetal, 0xc9cfd3),
    insul: T(B.plastic, 0xe7ecef), black: T(B.plastic, 0x0e1113), dark: T(B.plastic, 0x3a4249),
    bond: T(B.hwPlastic, 0x2fbf5f), yellow: T(B.hwPlastic, 0xf2d21a), strap: T(B.rubber, 0x15191c), tab: T(B.rubber, 0xe8730c), sleeve: T(B.plastic, 0xdfe9ee),
    tray: T(B.plastic, 0x8a949c), cordBlue: T(B.hwPlastic, 0x2f7fe0), cordGray: T(B.hwPlastic, 0xb4bcc4), cordGreen: T(B.hwPlastic, 0x37c06a), cordOrange: T(B.hwPlastic, 0xf0962a),
    tagM: T(B.plastic, 0xf3f4f5), tablet: T(B.plastic, 0x2a3238)
  };

  /* Rails: powder-coat black with the square holes (3 per rack unit) drawn into a canvas texture. */
  const railTex = (function () {
    const c = document.createElement('canvas'); c.width = 32; c.height = 128;   // 128 px = 1 rack unit stretched; repeated per unit
    const g = c.getContext('2d');
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, 32, 128);
    g.fillStyle = '#060708';
    [12, 53, 94].forEach((y) => g.fillRect(11, y, 10, 14));
    const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 42); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const railMat = new MeshStandardMaterial({ color: 0x6a737c, map: railTex, metalness: 0.5, roughness: 0.55 });

  /* ---------- environment (the one HDRI) ---------- */
  const pmrem = new PMREMGenerator(renderer);
  pending++;
  new HDRLoader().load(HOME + 'env/studio_small_09_' + (phone ? '256x128' : '512x256') + '.hdr', (t) => {
    t.mapping = EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(t).texture;
    scene.environmentIntensity = 1.5;
    t.dispose(); pmrem.dispose();
    done();
  }, undefined, () => { loadedErr++; done(); });

  /* ---------- helpers ---------- */
  const world = new Group(); scene.add(world);
  const anim = [];   // { obj, from, a, b, fn(obj, t) }   t = 0..1 reveal for that part
  const reveal = (obj, from, a, b, fn) => { world.add(obj); anim.push({ obj, from, a, b, fn }); return obj; };
  const slide = (dx, dy, dz) => (o, t) => { const e = 1 - ease(t); o.position.set(o.userData.x + dx * e, o.userData.y + dy * e, o.userData.z + dz * e); };
  const place = (o, x, y, z) => { o.userData.x = x; o.userData.y = y; o.userData.z = z; o.position.set(x, y, z); return o; };
  const grow = (o, t) => { const e = ease(t); o.scale.set(e, e, e); };
  function inst(geo, material, matrices, colors) {
    if (material.isTint) { if (!geo.attributes.color) tintGeo(geo, material.color); material = material.base; }
    const im = new InstancedMesh(geo, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
    if (colors) for (let i = 0; i < colors.length; i++) im.setColorAt(i, colors[i]);
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
    im.castShadow = false; im.receiveShadow = true;
    return im;
  }
  const part = () => new Part();
  const shaded = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

  /* ---------- stop 1: floor, rack frame, rails, ladder rack, busbar, bonding ---------- */
  const staticG = new Group(); world.add(staticG);
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const a = new CanvasTexture(c);
    const ft = tex(HOME, 'Concrete034', 'Color'); ft.repeat.set(3, 3);
    const floor = new Mesh(new CircleGeometry(1.7, 48), new MeshStandardMaterial({ color: 0x9aa0a5, map: ft, normalMap: tex(HOME, 'Concrete034', 'NormalGL'), roughnessMap: tex(HOME, 'Concrete034', 'Roughness'), alphaMap: a, transparent: true, depthWrite: false }));
    floor.material.normalMap.repeat.set(3, 3); floor.material.roughnessMap.repeat.set(3, 3);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.0, 0.1); floor.receiveShadow = true; staticG.add(floor);
  })();
  (function () {
    const p = part(), H = 42 * U;
    // four posts + top and bottom frames (open frame: no side panels, so the inside stays visible)
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((s) => p.box(M.frame, 0.04, H + 0.1, 0.04, s[0] * 0.285, Y0 + H / 2 - 0.05 + 0.05, s[1] * 0.46, 0.4));
    [Y0 - 0.06, Y0 + H + 0.04].forEach((y) => {
      p.box(M.frame, 0.61, 0.04, 0.04, 0, y, 0.46, 0.4); p.box(M.frame, 0.61, 0.04, 0.04, 0, y, -0.46, 0.4);
      p.box(M.frame, 0.04, 0.04, 0.92, -0.285, y, 0, 0.4); p.box(M.frame, 0.04, 0.04, 0.92, 0.285, y, 0, 0.4);
    });
    // casters
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((s) => { p.cyl(M.black, 0.03, 0.04, s[0] * 0.26, 0.04, s[1] * 0.42, 0, 0, 0, 14); p.box(M.silver, 0.05, 0.02, 0.05, s[0] * 0.26, 0.09, s[1] * 0.42); });
    // top cable entry shelf
    p.box(M.shelf, 0.52, 0.012, 0.3, 0, Y0 + H + 0.065, 0.1, 0.4);
    staticG.add(p.build({ cast: true }));
    // mounting rails (front and rear pairs), with the square-hole texture
    const rg = new BoxGeometry(0.03, H, 0.02); const rl = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((s) => rl.push(mat(s[0] * (RW / 2 + 0.015), Y0 + H / 2, s[1] * 0.405 + (s[1] > 0 ? 0 : 0))));
    const rails = new InstancedMesh(rg, railMat, rl.length);
    rl.forEach((m, i) => rails.setMatrixAt(i, m)); rails.frustumCulled = false; rails.castShadow = true; rails.receiveShadow = true;
    staticG.add(rails);
    // rack unit numbers every 6U on the front left rail (small ticks)
    const ticks = []; for (let u = 6; u <= 42; u += 6) ticks.push(mat(-(RW / 2 + 0.034), yU(u), 0.41 + 0.002));
    staticG.add(inst(new BoxGeometry(0.008, 0.004, 0.002), M.white, ticks));
  })();
  (function () {   // overhead ladder rack: two side rails, instanced rungs, hanger rods, a stub of the run in each direction
    const p = part(), y = 2.34, hw2 = 0.15, L = 1.1;
    p.box(M.steel, 2 * L, 0.05, 0.02, 0, y, hw2, 0.4); p.box(M.steel, 2 * L, 0.05, 0.02, 0, y, -hw2, 0.4);
    p.box(M.steel, 2 * L, 0.012, 0.02, 0, y + 0.025, hw2); p.box(M.steel, 2 * L, 0.012, 0.02, 0, y + 0.025, -hw2);
    [-0.5, 0.5].forEach((x) => [hw2, -hw2].forEach((z) => p.cyl(M.silver, 0.005, 0.5, x, y + 0.27, z, 0, 0, 0, 8)));
    [-0.5, 0.5].forEach((x) => p.box(M.steel, 0.04, 0.02, 0.36, x, y + 0.53, 0));
    // rack-top bracket tying the ladder to the cable-entry shelf area
    p.box(M.steel, 0.03, 0.02, 0.36, 0.0, y - 0.04, 0);
    staticG.add(p.build({ cast: true }));
    const rungs = []; for (let x = -L + 0.1; x <= L - 0.09; x += 0.23) rungs.push(mat(x, y + 0.012, 0));
    staticG.add(inst(new BoxGeometry(0.025, 0.012, 2 * hw2), M.steel, rungs));
  })();
  const busbar = new Group(); staticG.add(busbar);
  (function () {   // grounding busbar on a floor stand, bonded to the rack and to the ladder rack with green jumpers
    const p = part(), bx = -0.52, by = 0.5, bz = 0.3;
    p.box(M.shelf, 0.05, 0.9, 0.02, bx, 0.45, bz - 0.04, 0.4);               // stand
    p.box(M.shelf, 0.26, 0.02, 0.2, bx, 0.01, bz - 0.02, 0.4);
    p.box(M.copper, 0.07, 0.34, 0.006, bx, by, bz - 0.015);                   // bar
    [-0.12, 0.12].forEach((dy) => p.cyl(M.insul, 0.012, 0.02, bx, by + dy, bz - 0.03, Math.PI / 2, 0, 0, 12));
    for (let i = 0; i < 6; i++) { p.cyl(M.brass, 0.006, 0.012, bx - 0.016 + (i % 2) * 0.032, by - 0.13 + i * 0.05, bz - 0.01, Math.PI / 2, 0, 0, 8); }
    // jumpers: busbar -> lower rack post, busbar -> rack side, and a bond up to the ladder rack
    p.tube(M.bond, [V(bx + 0.02, by - 0.13, bz), V(bx + 0.14, by - 0.2, bz + 0.12), V(-0.3, 0.22, 0.32), V(-0.285, 0.2, 0.44)], 0.0065, 28, 6, 0.5);
    p.tube(M.bond, [V(bx + 0.02, by + 0.13, bz), V(bx + 0.1, by + 0.45, bz + 0.1), V(-0.285, 1.5, 0.46)], 0.0065, 36, 6, 0.5);
    p.tube(M.bond, [V(-0.285, 2.02, 0.46), V(-0.34, 2.16, 0.3), V(-0.15, 2.3, 0.15)], 0.0055, 24, 6, 0.5);
    [[-0.285, 0.2, 0.44], [-0.285, 1.5, 0.46], [-0.285, 2.02, 0.46]].forEach((l) => p.box(M.brass, 0.014, 0.022, 0.006, l[0], l[1], l[2] + 0.02));
    busbar.add(p.build({ cast: true }));
  })();

  /* ---------- stop 2: vertical managers (both sides) and horizontal managers ---------- */
  (function () {
    [-1, 1].forEach((s, si) => {
      const g = new Group(), p = part(), H = 42 * U + 0.06;
      p.box(M.mgr, 0.01, H, 0.14, s * 0.055, 0, 0.0, 0.4);                   // inner wall
      p.box(M.mgr, 0.01, H, 0.14, -s * 0.055, 0, 0.0, 0.4);                  // outer wall
      p.box(M.mgr, 0.11, H, 0.01, 0, 0, -0.07, 0.4);                         // back
      p.box(M.mgr, 0.11, 0.012, 0.14, 0, H / 2, 0, 0.4); p.box(M.mgr, 0.11, 0.012, 0.14, 0, -H / 2, 0, 0.4);
      g.add(shaded(p.build({ cast: true })));
      // fingers, one pair per 2U on both walls (instanced)
      const f = []; for (let u = 1; u <= 42; u += 2) { f.push(mat(s * 0.03, -H / 2 + 0.03 + (u - 1) * U, 0.065)); f.push(mat(-s * 0.03, -H / 2 + 0.03 + (u - 1) * U, 0.065)); }
      g.add(inst(new BoxGeometry(0.05, 0.012, 0.012), M.mgr, f));
      const base = [s * 0.355, Y0 + 21 * U, 0.36];
      place(g, base[0], base[1], base[2]);
      reveal(g, 2, 0, 0.8, slide(s * 0.5, 0, 0.18));
    });
    LAYOUT.filter((l) => l[0] === 'hm').forEach((l, i) => {
      const g = new Group(), p = part();
      p.box(M.mgr, RW, U - 0.003, 0.012, 0, 0, 0.0, 0.4);
      p.box(M.black, RW - 0.12, 0.016, 0.004, 0, 0, 0.007);
      g.add(shaded(p.build({ cast: true })));
      const f = []; for (let k = -2; k <= 2; k++) f.push(mat(k * 0.08, 0, 0.03));
      g.add(inst(new BoxGeometry(0.012, U - 0.012, 0.06), M.mgr, f));
      place(g, 0, yU(l[1]), ZF - 0.012);
      reveal(g, 2, (i % 4) * 0.08, 0.6 + (i % 4) * 0.08, slide(0, 0, 0.55));
    });
  })();

  /* ---------- stop 3: patch panels and the fiber enclosure ---------- */
  const portXs = []; for (let i = 0; i < 24; i++) portXs.push(-0.1926 + i * 0.0168);
  (function () {
    LAYOUT.filter((l) => l[0] === 'panel' || l[0] === 'fiber').forEach((l, i) => {
      const g = new Group(), p = part(), h = l[2], isF = l[0] === 'fiber';
      p.box(M.face, RW, h * U - 0.002, 0.02, 0, 0, 0, 0.4);
      p.box(M.silver, 0.016, h * U - 0.01, 0.006, -(RW / 2 + 0.002), 0, 0.012); p.box(M.silver, 0.016, h * U - 0.01, 0.006, RW / 2 + 0.002, 0, 0.012);
      if (!isF) {
        // port label strip(s) above each row of 24 ports, numbered ticks every 6 ports
        const rows = h === 2 ? [0.025, -0.012] : [-0.004];
        const ports = [], ticks = [], lens = [];
        rows.forEach((ry) => {
          p.box(M.white, 0.4, 0.004, 0.002, 0, ry + 0.0105, 0.0105);
          portXs.forEach((x, k) => { ports.push(mat(x, ry - 0.003, 0.012)); if (k % 6 === 0) ticks.push(mat(x - 0.004, ry + 0.0105, 0.0125)); });
        });
        g.add(inst(new BoxGeometry(0.0145, 0.0125, 0.01), M.sock, ports));
        g.add(inst(new BoxGeometry(0.0095, 0.0075, 0.012), M.socketDark, ports.map((m) => m.clone().multiply(mat(0, 0, 0.002)))));
        g.add(inst(new BoxGeometry(0.003, 0.004, 0.002), M.black, ticks));
        p.box(M.copper, 0.03, 0.006, 0.002, -0.215, 0, 0.011);   // port-group marker bar
      } else {
        // fiber enclosure: 6 cassette slots, each with 6 duplex LC adapters; the drawer front is the splice tray (later)
        for (let k = 0; k < 6; k++) {
          const cx = -0.18 + k * 0.072;
          p.box(M.dark, 0.066, 0.058, 0.01, cx, 0.0, 0.012);
          p.box(M.white, 0.05, 0.005, 0.002, cx, 0.037 - 0.0, 0.018);
        }
        const lc = []; for (let k = 0; k < 6; k++) for (let j = 0; j < 6; j++) lc.push(mat(-0.18 + k * 0.072 - 0.0275 + j * 0.011, -0.004, 0.02));
        g.add(inst(new BoxGeometry(0.0085, 0.013, 0.014), M.aqua, lc));
        p.box(M.silver, 0.12, 0.012, 0.004, 0.0, -0.0345, 0.012);
      }
      g.add(shaded(p.build({ cast: true })));
      place(g, 0, yU(l[1], h), ZF);
      reveal(g, 3, (i % 3) * 0.1, 0.6 + (i % 3) * 0.1, slide(0, 0, 0.6));
    });
  })();

  /* ---------- stop 4: switches, with port LEDs that come on ---------- */
  const ledMats = [];
  (function () {
    const ledCol = [new Color(0x3cff7a), new Color(0xffb02e)];
    LAYOUT.filter((l) => l[0] === 'switch').forEach((l, i) => {
      const g = new Group(), p = part();
      p.box(M.faceLight, RW, U - 0.002, 0.012, 0, 0, 0.0, 0.4);
      p.box(M.dark, RW - 0.02, U - 0.006, 0.3, 0, 0, -0.156, 0.4);                  // chassis body
      p.box(M.face, 0.4, U - 0.012, 0.004, -0.02, 0, 0.007);                         // port field
      p.box(M.black, 0.03, 0.012, 0.004, 0.2, 0.008, 0.007);                          // console / mgmt
      for (let k = 0; k < 4; k++) p.box(M.silver, 0.016, 0.009, 0.014, 0.18 + (k % 2) * 0.018 - 0.0, -0.002 - (k >> 1) * 0.0, 0.014 - 0.007 + 0.0 + 0);
      p.box(M.black, 0.01, 0.006, 0.002, -0.215, 0.012, 0.007);
      g.add(shaded(p.build({ cast: true })));
      const ports = [], leds = [], cols = [];
      [0.0105, -0.0105].forEach((ry, r) => {
        for (let k = 0; k < 24; k++) {
          const x = -0.2 + k * 0.0152;
          ports.push(mat(x, ry - 0.0015, 0.011));
          leds.push(mat(x, r ? ry - 0.009 : ry + 0.0042, 0.0125));
          cols.push(ledCol[(k * 7 + r * 3 + i * 5) % 11 === 0 ? 1 : 0].clone());
        }
      });
      g.add(inst(new BoxGeometry(0.0125, 0.0092, 0.008), M.socketDark, ports));
      const ledM = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const ledMesh = new InstancedMesh(new BoxGeometry(0.0045, 0.0022, 0.002), ledM, leds.length);
      leds.forEach((m, k) => { ledMesh.setMatrixAt(k, m); ledMesh.setColorAt(k, cols[k]); });
      ledMesh.instanceMatrix.needsUpdate = true; ledMesh.frustumCulled = false;
      g.add(ledMesh);
      ledMats.push({ m: ledM, mesh: ledMesh, base: cols });
      place(g, 0, yU(l[1]), ZF);
      reveal(g, 4, (i % 4) * 0.06, 0.55 + (i % 4) * 0.06, slide(0, 0, 0.6));
    });
  })();
  const ledAt = (p) => clamp01(p - 4.45);   // LEDs light after the switches seat

  /* ---------- stop 5: patch cords through the managers, hook-and-loop wraps, label tags ---------- */
  const cordGroups = [];
  const wrapGroups = [];
  const tagGroups = [];
  (function () {
    const cc = [M.cordBlue, M.cordGray, M.cordGreen, M.cordBlue, M.cordOrange, M.cordGray, M.cordBlue, M.cordGreen];
    PAIRS.forEach((pr, pi) => {
      const side = pr[2], pyF = yU(pr[0], pr[0] === 30 ? 2 : 1), syF = yU(pr[1]);
      const p = part(), wraps = [], tags = [];
      const nCord = 8, pXs = [], sXs = [];
      for (let k = 0; k < nCord; k++) { const col = k * 2 + (side < 0 ? 0 : 8); pXs.push(portXs[col]); sXs.push(-0.2 + (col + 1) * 0.0152); }
      for (let k = 0; k < nCord; k++) {
        const mx = side * (0.355 + ((k % 4) - 1.5) * 0.0085), mz = 0.435 + (k >> 2) * 0.0085 + 0.02;
        const px = pXs[k], sx = sXs[k];
        const pts = [
          V(px, pyF + (pr[0] === 30 ? 0.0 : -0.003), ZF + 0.008), V(px, pyF - 0.003, ZF + 0.05), V(lerp(px, mx, 0.55), pyF - 0.02, mz + 0.015),
          V(mx, pyF - 0.032, mz), V(mx, lerp(pyF, syF, 0.5), mz + 0.004), V(mx, syF + 0.032, mz), V(lerp(sx, mx, 0.55), syF + 0.02, mz + 0.015),
          V(sx, syF + 0.003, ZF + 0.05), V(sx, syF - 0.004, ZF + 0.008)
        ];
        p.tube(cc[k % cc.length], pts, 0.0036, 56, 6, 0.45);
      }
      const g = p.build({ cast: false, receive: true });
      g.children.forEach((m) => { m.userData.full = m.geometry.index.count; });
      cordGroups.push(g);
      // hook-and-loop wraps along the vertical run inside the manager (instanced)
      const x0 = side * 0.355, yA = pyF - 0.05, yB = syF + 0.05;
      for (let y = Math.min(yA, yB) + 0.02; y < Math.max(yA, yB) - 0.01; y += 0.07) wraps.push(mat(x0, y, 0.44));
      const wg = new Group();
      wg.add(inst(new BoxGeometry(0.052, 0.014, 0.034), M.strap, wraps));
      wg.add(inst(new BoxGeometry(0.014, 0.012, 0.006), M.tab, wraps.map((m) => m.clone().multiply(mat(side * 0.02, 0, 0.019)))));
      wrapGroups.push({ g: wg, n: wraps.length, base: wraps });
      // label tags at both cord ends
      for (let k = 0; k < nCord; k += 2) { tags.push(mat(pXs[k], pyF - 0.015, ZF + 0.054)); tags.push(mat(sXs[k], syF + 0.012, ZF + 0.054)); }
      const tg = new Group(); tg.add(inst(new BoxGeometry(0.02, 0.011, 0.002), M.tagM, tags));
      tagGroups.push(tg);
      const holder = new Group(); holder.add(g, wg, tg); holder.userData.pi = pi;
      world.add(holder);
      anim.push({ obj: holder, from: 5, a: 0, b: 1, fn: (o, t) => {
        const tc = clamp01(t / 0.6), tw = clamp01((t - 0.55) / 0.3), tt = clamp01((t - 0.75) / 0.25);
        const stg = pi * 0.06; const cd = clamp01((tc - stg) / (1 - stg));
        g.children.forEach((m) => m.geometry.setDrawRange(0, Math.max(0, Math.floor(m.userData.full * cd / 3) * 3)));
        g.visible = cd > 0;
        wg.visible = tw > 0; wg.scale.set(1, 1, 1); wg.children.forEach((c) => { c.count = Math.round(c.instanceMatrix.count * ease(tw)); });
        tg.visible = tt > 0; tg.children.forEach((c) => { c.count = Math.round(c.instanceMatrix.count * ease(tt)); });
      } });
    });
  })();

  /* ---------- stop 6: fiber trunk, splice drawer, arc flash, sleeves, test tablet with the illustrative trace ---------- */
  const fx = new Group(); world.add(fx);
  const flash = new Mesh(new SphereGeometry(0.02, 12, 8), new MeshBasicMaterial({ color: 0xbfe3ff, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  const flashHalo = new Mesh(new SphereGeometry(0.05, 12, 8), new MeshBasicMaterial({ color: 0x7fb8ff, blending: AdditiveBlending, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
  const drawer = new Group(), sleeves = new Group();
  let trunkMesh = null, tabletTex = null, tabletCtx = null, traceP = -1;
  const SPL = { x: -0.04, y: yU(41, 2) - 0.03, z: 0.43 + 0.34 };
  (function () {
    // trunk: yellow OS2-style cable from the ladder rack down into the enclosure, strapped with hook-and-loop wraps
    const p = part();
    p.tube(M.yellow, [V(0.2, 2.33, 0.05), V(0.2, 2.2, 0.2), V(0.205, 2.1, 0.36), V(0.2, 2.03, 0.4), V(0.2, 1.99, 0.405)], 0.0075, 60, 8, 0.5);
    p.box(M.strap, 0.026, 0.014, 0.026, 0.2, 2.11, 0.36); p.box(M.tab, 0.008, 0.012, 0.004, 0.2, 2.11, 0.375);
    trunkMesh = p.build({ cast: true });
    trunkMesh.children.forEach((m) => { m.userData.full = m.geometry.index.count; });
    reveal(trunkMesh, 6, 0, 0.4, (o, t) => { o.children.forEach((m) => { m.geometry.setDrawRange(0, Math.floor(m.userData.full * t / 3) * 3); }); });
    // drawer: slides out of the enclosure; splice tray inside with fusion pads, fibers and protection sleeves
    const d = part(), dx = 0, dz = 0;
    d.box(M.tray, 0.43, 0.012, 0.34, 0, 0, 0.17, 0.4); d.box(M.tray, 0.43, 0.04, 0.012, 0, 0.012, 0.34); d.box(M.tray, 0.012, 0.03, 0.34, -0.2155, 0.012, 0.17); d.box(M.tray, 0.012, 0.03, 0.34, 0.2155, 0.012, 0.17);
    d.box(M.insul, 0.34, 0.004, 0.2, 0, 0.0075, 0.18);                         // splice tray bed
    for (let k = 0; k < 6; k++) d.box(M.dark, 0.03, 0.006, 0.022, -0.1 + k * 0.04, 0.012, 0.18);   // sleeve holders
    d.tube(M.yellow, [V(0.2, 0.03, 0.0), V(0.18, 0.016, 0.1), V(0.1, 0.014, 0.17), V(0.0, 0.014, 0.18)], 0.0028, 24, 6, 0.5);
    d.tube(M.aqua, [V(-0.2, 0.03, 0.0), V(-0.17, 0.016, 0.1), V(-0.1, 0.014, 0.17), V(-0.04, 0.014, 0.18)], 0.0026, 24, 6, 0.5);
    d.tube(M.cordOrange, [V(-0.0, 0.015, 0.12), V(0.12, 0.014, 0.1), V(0.14, 0.014, 0.24), V(0.0, 0.014, 0.25), V(-0.12, 0.014, 0.24), V(-0.14, 0.014, 0.12), V(-0.0, 0.015, 0.12)], 0.0022, 48, 5, 0.5);
    drawer.add(shaded(d.build({ cast: true })));
    const sl = []; for (let k = 0; k < 6; k++) sl.push(mat(-0.1 + k * 0.04, 0.0185, 0.18));
    const sm = inst(new CylinderGeometry(0.0042, 0.0042, 0.028, 10).rotateZ(Math.PI / 2), M.sleeve, sl);
    sleeves.add(sm);
    drawer.add(sleeves);
    flash.position.set(0.0, 0.025, 0.18); flashHalo.position.copy(flash.position); drawer.add(flash, flashHalo);
    place(drawer, 0, yU(41, 2) - 0.02, ZF - 0.34);
    reveal(drawer, 6, 0.1, 0.55, (o, t) => { o.position.set(o.userData.x, o.userData.y, o.userData.z + ease(t) * 0.3); });
    // test tablet on a small stand: a canvas texture draws the "illustrative" trace
    const tg = new Group(), tp = part();
    tp.box(M.tablet, 0.46, 0.32, 0.014, 0, 0, 0, 0.4);
    tp.cyl(M.silver, 0.008, 0.3, 0.0, -0.3, -0.01, 0, 0, 0, 10);
    [0, 2.1, 4.2].forEach((a) => tp.between(M.silver, V(0, -0.42, -0.01), V(Math.sin(a) * 0.2, -0.82, Math.cos(a) * 0.2 - 0.01), 0.006, 6));
    tg.add(shaded(tp.build({ cast: true })));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 352; tabletCtx = cv.getContext('2d');
    tabletTex = new CanvasTexture(cv); tabletTex.colorSpace = SRGBColorSpace; tabletTex.minFilter = LinearMipmapLinearFilter; tabletTex.anisotropy = 4;
    const scr = new Mesh(new PlaneGeometry(0.44, 0.303), new MeshBasicMaterial({ map: tabletTex, toneMapped: false }));
    scr.position.z = 0.0075; tg.add(scr);
    tg.rotation.y = -0.25;
    place(tg, TABLET.x, TABLET.y, TABLET.z);
    reveal(tg, 6, 0.55, 1, (o, t) => { grow(o, Math.min(1, t * 1.4)); });
    drawTrace(0);
  })();
  function drawTrace(t) {
    const g = tabletCtx, W = 512, H = 352;
    if (!g) return;
    g.fillStyle = '#071218'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,200,220,0.18)'; g.lineWidth = 1;
    for (let x = 40; x < W; x += 54) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 292); g.stroke(); }
    for (let y = 70; y <= 292; y += 37) { g.beginPath(); g.moveTo(40, y); g.lineTo(W - 20, y); g.stroke(); }
    g.fillStyle = '#9fdcec'; g.font = 'bold 22px sans-serif'; g.fillText('TEST TRACE', 40, 36);
    g.fillStyle = '#ffd37a'; g.font = 'bold 20px sans-serif'; g.textAlign = 'right'; g.fillText('ILLUSTRATIVE', W - 20, 36); g.textAlign = 'left';
    g.fillStyle = '#7fa6b3'; g.font = '16px sans-serif'; g.fillText('Example shape only. No real readings.', 40, 58);
    // a made-up trace: a falling line, a launch spike, one small step (the splice) and an end spike
    const pts = [[40, 110], [58, 96], [66, 112], [170, 134], [176, 134], [182, 140], [290, 168], [296, 130], [300, 172], [420, 205], [428, 150], [434, 240], [W - 20, 246]];
    g.strokeStyle = '#4fe3a5'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    const total = pts.length - 1, upto = t * total;
    for (let i = 0; i < pts.length; i++) {
      if (i > upto + 1) break;
      let x = pts[i][0], y = pts[i][1];
      if (i > upto) { const f = upto - (i - 1); const a = pts[i - 1]; x = a[0] + (x - a[0]) * f; y = a[1] + (y - a[1]) * f; }
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#7fa6b3'; g.font = '15px sans-serif'; g.fillText('distance', W - 90, 316); g.save(); g.translate(18, 220); g.rotate(-Math.PI / 2); g.fillText('level', 0, 0); g.restore();
    if (t >= 0.999) { g.fillStyle = 'rgba(79,227,165,0.16)'; g.fillRect(176, 300, 190, 40); g.strokeStyle = '#4fe3a5'; g.lineWidth = 2; g.strokeRect(176, 300, 190, 40); g.fillStyle = '#c9ffe8'; g.font = 'bold 20px sans-serif'; g.fillText('Tested & documented', 184, 327); }
    tabletTex.needsUpdate = true;
  }

  /* ---------- the build value p drives everything ---------- */
  const st = { target: snap ? 6 : 1, p: snap ? 6 : 1 };
  function apply(p) {
    anim.forEach((a) => {
      const t = clamp01((p - (a.from - 1) - a.a) / (a.b - a.a));
      a.obj.visible = t > 0.0001;
      if (a.obj.visible) a.fn(a.obj, t);
    });
    // LEDs
    const l = ledAt(p);
    ledMats.forEach((e) => { e.m.color.setScalar(0.06 + 1.9 * l); e.mesh.visible = l > 0.001 || p >= 3.9; });
    // arc flash: a short bump while the splice is made, then the sleeves shrink over it
    const fp = Math.max(0, 1 - Math.abs(p - 5.62) / 0.1);
    flash.visible = flashHalo.visible = fp > 0.01; flash.scale.setScalar(0.6 + fp * 1.4); flashHalo.scale.setScalar(0.5 + fp * 2.2);
    flash.material.opacity = fp; flashHalo.material.opacity = 0.4 * fp;
    sleeves.visible = p > 5.66;
    // trace draws as p arrives at 6, reversible
    const tr = clamp01((p - 5.72) / 0.28);
    if (Math.abs(tr - traceP) > 0.01 || (tr >= 0.999) !== (traceP >= 0.999)) { traceP = tr; drawTrace(tr); }
    camPose(p, camera);
  }
  function camPose(p, cam) {
    const k = Math.min(5, Math.floor(p)), f = p - k, A = POSE[k], Bp = POSE[k + 1];
    const yaw = lerp(A[0], Bp[0], f), tx = lerp(A[1], Bp[1], f), halfW = lerp(A[2], Bp[2], f);
    const tf = Math.tan(cam.fov * Math.PI / 360), half = (MODEL_Y1 - MODEL_Y0) / 2 + 0.08;
    const d = Math.max(half / tf, halfW / (tf * cam.aspect)), cy = (MODEL_Y0 + MODEL_Y1) / 2;
    cam.position.set(tx + Math.sin(yaw) * d, cy + d * 0.06, Math.cos(yaw) * d);
    cam.lookAt(tx, cy, 0); cam.updateMatrixWorld();
  }

  function tick(t) {
    if (destroyed) return;
    const dt = Math.min(0.25, Math.max(0.001, (t - lastT) / 1000)); lastT = t;   // real elapsed time, so slow devices land as fast as fast ones
    const d = st.target - st.p;
    if (snap) st.p = st.target;
    else {
      // ease toward the target, with a minimum speed so a drag always lands on a clean stop
      const step = Math.max(Math.abs(d) * (1 - Math.exp(-5.2 * dt)), 0.9 * dt);
      st.p = Math.abs(d) <= step + 0.002 ? st.target : st.p + Math.sign(d) * step;
    }
    apply(st.p);
    renderer.render(scene, camera);
    frames++; if (window.__hybRack3d) window.__hybRack3d.frames = frames;
    if (st.p !== st.target && onscreen && !document.hidden) requestAnimationFrame(tick); else running = false;
  }
  function invalidate() {
    if (running || destroyed || !onscreen || document.hidden || !sized) return;
    running = true; lastT = performance.now() - 16; requestAnimationFrame(tick);
  }

  /* ---------- sizing: the canvas fills the frame; the label bands are the free sides around the rack ---------- */
  const VB = { w: 460, h: 651 }, DRAW = { x: 0, y: 0, w: 100, h: 100 };
  let W = 0, H = 0;
  function fit() {
    W = frame.clientWidth; H = frame.clientHeight;
    if (!W || !H) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(W, H, false);
    canvas.style.position = 'absolute'; canvas.style.left = '0px'; canvas.style.top = '0px'; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    camera.aspect = W / H; camera.updateProjectionMatrix();
    VB.w = W; VB.h = H;
    sized = true;
    apply(st.p);
    placeLabels(); invalidate();
  }
  const ro = new ResizeObserver(fit); ro.observe(frame);
  const io = new IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; if (onscreen) invalidate(); }, { rootMargin: '80px' });
  io.observe(frame);
  document.addEventListener('visibilitychange', invalidate);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; });
  canvas.addEventListener('webglcontextrestored', () => { invalidate(); });

  /* ---------- labels: project world anchors with the TARGET pose; the model box is the rack (plus the tablet at stop 6) ---------- */
  const Sx = window.HybStage;
  const labels = Sx.createLabels({ frame, vb: VB, draw: DRAW, mode: 'lr', max: 3 });
  const LAB = {
    1: [['Overhead ladder rack', 0.55, 2.35, 0], ['Grounding busbar', -0.52, 0.5, 0.3]],
    2: [['Vertical manager', -0.355, 1.5, 0.43], ['Horizontal manager', 0.1, yU(38), 0.43]],
    3: [['Fiber enclosure', 0.15, yU(41, 2), ZF], ['Copper patch panel', 0.15, yU(39), ZF], ['Port positions labeled', -0.1, yU(35), ZF]],
    4: [['Switch', 0.1, yU(37), ZF], ['Port LEDs', -0.12, yU(33) + 0.01, ZF]],
    5: [['Hook-and-loop wraps', 0.355, yU(36), 0.44], ['Label tags', -0.2, yU(39) - 0.015, ZF + 0.054]],
    6: [['Fiber trunk', 0.205, 2.1, 0.36], ['Splice tray', 0.2, yU(41, 2) - 0.02, ZF + 0.3], ['Test trace (illustrative)', TABLET.x, TABLET.y, TABLET.z]]
  };
  const tmpCam = new PerspectiveCamera();
  function projectCam(stop) {   // the camera a given stop settles on (same maths as apply)
    tmpCam.fov = camera.fov; tmpCam.aspect = camera.aspect; tmpCam.near = camera.near; tmpCam.far = camera.far; tmpCam.updateProjectionMatrix();
    camPose(stop, tmpCam); return tmpCam;
  }
  let curStop = st.target >= 6 ? 6 : 1;
  function placeLabels() {
    if (!sized) return;
    const cam = projectCam(curStop);
    const w = (x, y, z) => new Vector3(x, y, z).project(cam);
    const px = (v) => ({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H });
    const xr = MODEL_X;
    const cs = [w(-MODEL_X, MODEL_Y0, 0.35), w(xr, MODEL_Y0, 0.35), w(-MODEL_X, MODEL_Y1, 0.35), w(xr, MODEL_Y1, 0.35), w(-MODEL_X, MODEL_Y0, -0.35), w(xr, MODEL_Y1, -0.35)].map(px);
    DRAW.x = Math.max(0, Math.min.apply(null, cs.map((c) => c.x))); DRAW.y = Math.max(0, Math.min.apply(null, cs.map((c) => c.y)));
    DRAW.w = Math.min(W, Math.max.apply(null, cs.map((c) => c.x))) - DRAW.x; DRAW.h = Math.min(H, Math.max.apply(null, cs.map((c) => c.y))) - DRAW.y;
    const out = [];
    (LAB[curStop] || []).forEach((l) => {
      const v = w(l[1], l[2], l[3]);
      if (v.z >= 1) return;
      const a = px(v);
      if (a.x < -4 || a.x > W + 4 || a.y < -4 || a.y > H + 4) return;
      out.push({ text: l[0], ax: a.x, ay: a.y });
    });
    labels.show(out);
  }

  window.__hybRack3d = { frames: 0, scene: scene, get stop() { return curStop; }, get p() { return st.p; }, get ready() { return sized && pending === 0; }, calls: () => renderer.info.render.calls, tris: () => renderer.info.render.triangles, geometries: () => renderer.info.memory.geometries, textures: () => renderer.info.memory.textures, tier: tier };

  function setState(stop) {
    stop = Math.max(1, Math.min(6, Math.round(stop)));
    curStop = stop; st.target = stop;
    if (snap) st.p = stop;
    placeLabels(); invalidate();
    window.__hybLabelCheck = window.__hybLabelCheck || {};
    window.__hybLabelCheck.rack = labels.check;
  }
  apply(st.p);
  const sceneMs = Math.round(performance.now() - tStart);   // synchronous scene construction

  let finished = false;
  return new Promise((resolve) => {
    const finish = async () => {
      if (finished) return; finished = true;
      const buildMs = Math.round(performance.now() - tStart);
      // Warm every shader once at the fully built state, then step back, so no stop change hitches later.
      const saved = st.p; apply(6);
      const compile = renderer.extensions.has('KHR_parallel_shader_compile') ? () => renderer.compileAsync(scene, camera) : () => { renderer.compile(scene, camera); return Promise.resolve(); };
      const kids = world.children.slice();
      for (const k of kids) {
        const hidden = kids.filter((o) => o !== k && o.visible);
        hidden.forEach((o) => { o.visible = false; });
        try { await compile(); } catch (e) { /* first render compiles instead */ }
        hidden.forEach((o) => { o.visible = true; });
        await yieldMain();
      }
      st.p = saved; apply(st.p);
      el.appendChild(canvas);
      fit(); renderer.render(scene, camera);
      window.__hybRack3d.sceneMs = sceneMs; window.__hybRack3d.buildMs = buildMs; window.__hybRack3d.mountMs = Math.round(performance.now() - tStart);
      resolve({
        setState, check: labels.check,
        hideLabels: () => labels.show([]),
        destroy() {
          destroyed = true; ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', invalidate); labels.show([]);
          scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          renderer.dispose(); canvas.remove();
        }
      });
    };
    if (pending === 0) finish(); else onAllLoaded = finish;
    if (loadedErr) finish();
  });
}
