/* How We Build, Concept A: one large open warehouse / distribution building, built in code (no 3D asset file, no textures,
   no HDRI). Flat vector look: plain coloured faces, soft light, baked soft contact shadows. The building has no roof and no front wall
   (walls are single-sided and face inward), so the camera always looks in; walls between the camera and the room simply vanish.
   Systems (fiber, MDF, backbone, tray, wifi, cams, access) are separate groups. `setState(step)` shows the systems up to that step,
   highlights the current one, dims the rest and glides the camera. Render on demand: frames are drawn only while something moves.
   This file touches no DOM: it draws into the canvas it is given (a transferred OffscreenCanvas inside a worker, or a normal
   canvas on the page) and takes size and pointer input as calls. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry,
  SphereGeometry, CircleGeometry, PlaneGeometry, ShapeGeometry, Shape, Path, HemisphereLight, DirectionalLight, CanvasTexture,
  SRGBColorSpace, Color, Vector3, Matrix4, Quaternion, Euler, InstancedMesh, Sprite, SpriteMaterial
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ---------- layout (metres; x east, z toward the viewer, y up) ---------- */
const W = 28, D = 18, H = 9.6;                       // half width, half depth, wall height
const DOCKS = [-20, -12, -4, 4, 12];                 // dock roll-up doors on the back wall
const ROWS = [-17.5, -10.5, -3.5, 3.5, 10.5];        // racking rows (run along z)
const AISLES = [-14, -7, 0, 7];                      // aisle centre lines between the rows
const RZ0 = -12.2, BAY = 2.4, BAYS = 6;              // racking z start, bay length, bays per row
const RZ1 = RZ0 + BAY * BAYS;
const BEAMS = [1.5, 3.0, 4.5, 6.0];                  // beam heights
const TRAY_Y = 8.2, TRUSS_Y = 9.0;
const MAN_DOORS = [                                  // [wall, position along it]
  { wall: 'back', x: 22 }, { wall: 'west', z: -6 }, { wall: 'east', z: -8 }
];
const MDF = { x0: -28, x1: -21, z0: 11, z1: 18, h: 3.6, dz: 14.5 };   // MDF room, door centre z

/* systems: the step each first appears on, and the step that highlights it */
const SYS_STEP = { base: 0, fiber: 2, mdf: 3, backbone: 4, tray: 5, wifi: 6, cams: 7, access: 8 };
const STEP_SYS = { 2: 'fiber', 3: 'mdf', 4: 'backbone', 5: 'tray', 6: 'wifi', 7: 'cams', 8: 'access' };
const STEPS = 9;
const COL = {   // site palette (stage.css) for the systems; Field Ops RACK_COL for the rack gear
  fiber: 0x53c3df, cabling: 0xe0a85a, wireless: 0x7fe3a0, surveillance: 0xc79bff, access: 0xff9a6b,
  rFiber: 0x7d55c7, rHm: 0x39424c, rPanel: 0x2f6fb0, rSwitch: 0x1f8a5b, rFw: 0xa3424a, rUps: 0xb5651d
};
const DARK = new Color(0x0b1419);

/* camera poses: [target x, y, z, distance, azimuth deg, elevation deg] */
const POSE = {
  1: [-5, 0, 7, 112, 8, 38], 2: [-22, 0, 26, 40, 22, 32], 3: [-24.5, 1.2, 14.5, 15, -8, 36], 4: [3, 3, 3, 78, 4, 52],
  5: [-4, 6, 0, 56, 14, 40], 6: [-3, 4, -2, 42, 12, 46], 7: [0, 3, -4, 62, 4, 44], 8: [-3, 0, 4, 104, 10, 40], 9: [-5, 0, 7, 112, 8, 38]
};
const LIMIT = { el: [7, 84], dist: [16, 140] };

const mkCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const raf = (f) => (self.requestAnimationFrame ? self.requestAnimationFrame(f) : setTimeout(() => f(performance.now()), 16));
const caf = (id) => (self.cancelAnimationFrame ? self.cancelAnimationFrame(id) : clearTimeout(id));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rad = (d) => (d * Math.PI) / 180;
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const _m = new Matrix4(), _p = new Vector3(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3();

/* Geometry collected per material and merged into one mesh per material. at() runs fn in a local frame. */
class Batch {
  constructor() { this.b = new Map(); this.xf = null; }
  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1));
    if (this.xf) _m.premultiply(this.xf);
    geo.applyMatrix4(_m);
    let a = this.b.get(mat);
    if (!a) { a = []; this.b.set(mat, a); }
    a.push(geo);
    return this;
  }
  box(mat, w, h, d, x, y, z, ry) { return this.add(mat, new BoxGeometry(w, h, d), x, y, z, 0, ry || 0, 0); }
  cyl(mat, r, h, x, y, z, rx, ry, rz, seg) { return this.add(mat, new CylinderGeometry(r, r, h, seg || 14), x, y, z, rx || 0, ry || 0, rz || 0); }
  ball(mat, r, x, y, z) { return this.add(mat, new SphereGeometry(r, 12, 8), x, y, z); }
  pipe(mat, pts, r) {   // straight cylinders with a ball at every joint
    for (let i = 0; i < pts.length; i++) {
      this.ball(mat, r, pts[i][0], pts[i][1], pts[i][2]);
      if (i) {
        const a = new Vector3(...pts[i - 1]), c = new Vector3(...pts[i]), len = a.distanceTo(c);
        const g = new CylinderGeometry(r, r, len, 10, 1);
        g.applyMatrix4(new Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), c.clone().sub(a).normalize()), new Vector3(1, 1, 1)));
        this.add(mat, g);
      }
    }
    return this;
  }
  at(x, y, z, ry, s, fn) {
    const prev = this.xf;
    const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, ry || 0, 0)), new Vector3(s || 1, s || 1, s || 1));
    this.xf = prev ? prev.clone().multiply(m) : m;
    fn(this);
    this.xf = prev;
    return this;
  }
  flush(group) {
    for (const [mat, list] of this.b) { const mesh = new Mesh(mergeGeometries(list), mat); group.add(mesh); }
    this.b.clear();
  }
}

export function create(canvas, options) {
  options = options || {};
  const reduced = !!options.reduced;
  const phone = !!options.phone;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!options.preserve, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  const maxDpr = phone ? 1.5 : 2;

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 1, 500);
  scene.add(new HemisphereLight(0xf2f7fa, 0x4a5f6c, 2.3));
  const sun = new DirectionalLight(0xffffff, 1.55);
  sun.position.set(-30, 60, 40);
  scene.add(sun);

  /* ---------- materials: every one is registered with its system so the system can be dimmed or lit ---------- */
  const reg = [];
  const cache = new Map();
  function M(hex, sys, o) {
    o = o || {};
    const key = hex + '|' + sys + '|' + (o.alpha || 1) + '|' + (o.basic ? 1 : 0) + '|' + (o.map ? 1 : 0);
    if (cache.has(key)) return cache.get(key);
    const opt = { color: hex };
    if (o.alpha !== undefined) { opt.transparent = true; opt.opacity = o.alpha; opt.depthWrite = false; }
    if (o.map) opt.map = o.map;
    const m = o.basic ? new MeshBasicMaterial(opt) : new MeshLambertMaterial(opt);
    reg.push({ m, sys, base: new Color(hex), alpha: o.alpha, glow: o.glow === undefined ? 0.4 : o.glow });
    cache.set(key, m);
    return m;
  }
  const groups = {};
  for (const k of Object.keys(SYS_STEP)) { groups[k] = new Group(); scene.add(groups[k]); }

  /* soft shadow and coverage textures */
  const mkTex = (draw) => { const c = mkCanvas(128, 128); draw(c.getContext('2d')); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; };
  const shadowTex = mkTex((g) => { for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(0,0,0,.045)'; const k = i * 2.5; g.fillRect(k, k, 128 - k * 2, 128 - k * 2); } });
  const discTex = mkTex((g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.55, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 });
  const shadow = (w, d, x, z, y) => { const m = new Mesh(new PlaneGeometry(w, d), shadowMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y || 0.03, z); groups.base.add(m); };
  const floorShape = (pts) => {   // flat polygon on the floor from [x, z] points
    const s = new Shape();
    pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
    s.closePath();
    const g = new ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
  };

  /* ================= BASE: ground, building, racking, mezzanine, docks, closets ================= */
  const bb = new Batch();
  const cGround = M(0x0c151a, 'base'), cSlab = M(0x35495a, 'base'), cJoint = M(0x1c2a32, 'base'), cLine = M(0x8a7a3e, 'base');
  const cWall = M(0x4a6479, 'base'), cCap = M(0x86a3b6, 'base'), cPlinth = M(0x5d788b, 'base');
  const cAsphalt = M(0x172630, 'base'), cWalk = M(0x2a3a45, 'base'), cMark = M(0x56707f, 'base'), cYellow = M(0x9a8639, 'base');
  const cSteel = M(0x7f909c, 'base'), cDoor = M(0xaab8c1, 'base'), cSlat = M(0x8a9aa5, 'base'), cBlack = M(0x1b242a, 'base');
  const cFrame = M(0x2b3942, 'base');

  bb.box(cGround, 300, 0.2, 220, 0, -0.3, 6);
  bb.box(cSlab, 2 * W + 1.2, 0.3, 2 * D + 1.2, 0, -0.15, 0);
  for (let x = -21; x <= 21; x += 7) bb.box(cJoint, 0.06, 0.012, 2 * D, x, 0.008, 0);
  for (let z = -12; z <= 12; z += 6) bb.box(cJoint, 2 * W, 0.012, 0.06, 0, 0.008, z);
  for (const a of AISLES) for (const s of [-1, 1]) bb.box(cLine, 0.14, 0.014, BAY * BAYS + 1, a + s * 2.0, 0.012, (RZ0 + RZ1) / 2);
  bb.box(cLine, 2 * W - 4, 0.014, 0.14, 0, 0.012, -13.2);
  // lot and street on the front side
  bb.box(cAsphalt, 90, 0.1, 15, 4, -0.04, 27);
  for (let x = -14; x <= 34; x += 4.5) bb.box(cMark, 0.14, 0.012, 4.2, x, 0.02, 24.5);
  bb.box(cWalk, 300, 0.12, 2.4, 0, -0.04, 34.6);
  bb.box(cAsphalt, 300, 0.1, 13, 0, -0.05, 42);
  for (let x = -70; x <= 70; x += 7) bb.box(cYellow, 3, 0.012, 0.24, x, 0.02, 42);
  // cars in the lot (flat silhouettes, for scale)
  const carCols = [0x56707f, 0x9aa7b0, 0x3d5a73, 0x7b8790, 0x6a5a58, 0x4d6b61];
  [-9.2, -4.7, 4.3, 8.8, 17.8, 22.3].forEach((x, i) => {
    const c = M(carCols[i % carCols.length], 'base');
    bb.box(c, 1.8, 0.7, 4.4, x, 0.55, 24.6); bb.box(M(0x1d2a31, 'base'), 1.5, 0.5, 2.2, x, 1.15, 24.4);
    shadow(2.8, 5.4, x, 24.6);
  });
  // trailers backed against the rear docks (seen when the building is turned around)
  [-12, 4].forEach((x) => {
    bb.box(M(0xcfd8dd, 'base'), 2.7, 3.3, 12.5, x, 2.8, -D - 7.2);
    bb.box(cBlack, 2.5, 0.35, 12.2, x, 1.0, -D - 7.2);
    for (const wz of [-D - 11, -D - 12.3]) for (const s of [-1, 1]) bb.cyl(cBlack, 0.55, 0.3, x + s * 1.3, 0.6, wz, 0, 0, Math.PI / 2, 14);
  });

  // walls: single-sided planes facing inward, with openings. Seen from outside they are invisible.
  function wall(len, rotY, px, pz, holes) {
    const s = new Shape();
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, H); s.lineTo(-len / 2, H); s.closePath();
    holes.forEach((h) => { const p = new Path(); p.moveTo(h[0], h[1]); p.lineTo(h[0], h[3]); p.lineTo(h[2], h[3]); p.lineTo(h[2], h[1]); p.closePath(); s.holes.push(p); });
    const g = new ShapeGeometry(s); g.rotateY(rotY); g.translate(px, 0, pz);
    const m = new Mesh(g, cWall); groups.base.add(m);
  }
  const manHole = (v) => [v - 0.6, 0, v + 0.6, 2.4];
  wall(2 * W, 0, 0, -D, DOCKS.map((x) => [x - 1.7, 0, x + 1.7, 4.4]).concat([manHole(22)]));
  wall(2 * D, Math.PI / 2, -W, 0, [manHole(6)]);          // west wall: local x = -z
  wall(2 * D, -Math.PI / 2, W, 0, [manHole(-8)]);         // east wall: local x = +z
  wall(2 * W, Math.PI, 0, D, []);                         // front wall (never seen from the front)
  // plinth round all four sides, and a cap on the three visible walls
  bb.box(cPlinth, 2 * W + 0.4, 0.5, 0.4, 0, 0.25, -D - 0.2); bb.box(cPlinth, 2 * W + 0.4, 0.5, 0.4, 0, 0.25, D + 0.2);
  bb.box(cPlinth, 0.4, 0.5, 2 * D, -W - 0.2, 0.25, 0); bb.box(cPlinth, 0.4, 0.5, 2 * D, W + 0.2, 0.25, 0);
  bb.box(cCap, 2 * W + 0.4, 0.3, 0.45, 0, H + 0.1, -D - 0.2); bb.box(cCap, 0.45, 0.3, 2 * D + 0.4, -W - 0.2, H + 0.1, 0); bb.box(cCap, 0.45, 0.3, 2 * D + 0.4, W + 0.2, H + 0.1, 0);
  for (let x = -W + 4; x < W; x += 8) bb.box(M(0x3d566a, 'base'), 0.5, H, 0.3, x, H / 2, -D + 0.15);   // pilasters on the back wall
  for (let z = -D + 4; z < D; z += 8) { bb.box(M(0x3d566a, 'base'), 0.3, H, 0.5, -W + 0.15, H / 2, z); bb.box(M(0x3d566a, 'base'), 0.3, H, 0.5, W - 0.15, H / 2, z); }

  // dock doors: closed roll-ups with bumpers and a leveler plate
  DOCKS.forEach((x) => {
    bb.box(cFrame, 3.7, 0.3, 0.3, x, 4.55, -D + 0.12);
    bb.box(cFrame, 0.22, 4.4, 0.3, x - 1.78, 2.2, -D + 0.12); bb.box(cFrame, 0.22, 4.4, 0.3, x + 1.78, 2.2, -D + 0.12);
    bb.box(cDoor, 3.4, 4.3, 0.1, x, 2.15, -D + 0.06);
    for (let k = 0; k < 7; k++) bb.box(cSlat, 3.4, 0.07, 0.14, x, 0.45 + k * 0.6, -D + 0.12);
    bb.box(cSteel, 2.8, 0.1, 1.5, x, 0.06, -D + 0.9);
    for (const s of [-1, 1]) bb.box(cBlack, 0.3, 0.55, 0.3, x + s * 1.55, 1.2, -D + 0.25);
  });
  // man-doors
  const manDoor = (x, y, z, ry) => bb.at(x, y, z, ry, 1, (b) => {
    b.box(cFrame, 1.4, 0.18, 0.2, 0, 2.43, 0); b.box(cFrame, 0.16, 2.4, 0.2, -0.64, 1.2, 0); b.box(cFrame, 0.16, 2.4, 0.2, 0.64, 1.2, 0);
    b.box(M(0x8aa0ae, 'base'), 1.12, 2.3, 0.08, 0, 1.15, 0.04);
    b.box(cBlack, 0.06, 0.4, 0.1, 0.4, 1.0, 0.12);
  });
  manDoor(22, 0, -D + 0.1, 0); manDoor(-W + 0.1, 0, -6, Math.PI / 2); manDoor(W - 0.1, 0, -8, -Math.PI / 2);

  // racking: blue uprights, orange beams, pallets (instanced)
  const cUp = M(0x3b79b3, 'base'), cBeam = M(0xd9873a, 'base');
  const rand = rng(11);
  const pallets = [];
  const palCols = [0xb48f5a, 0xa9854f, 0xc9a56a, 0x9fb0ba, 0xc5d1d8, 0x4f7ea8, 0xb48f5a, 0xd8dde0];
  ROWS.forEach((xc) => {
    for (let i = 0; i <= BAYS; i++) for (const dx of [-1.3, -0.1, 0.1, 1.3]) bb.box(cUp, 0.1, 6.3, 0.1, xc + dx, 3.15, RZ0 + i * BAY);
    for (const y of BEAMS) for (const dx of [-1.3, -0.1, 0.1, 1.3]) bb.box(cBeam, 0.07, 0.14, BAY * BAYS, xc + dx, y, (RZ0 + RZ1) / 2);
    for (const dx of [-0.7, 0.7]) for (const y of BEAMS) bb.box(M(0x24323b, 'base'), 1.06, 0.03, BAY * BAYS, xc + dx, y + 0.07, (RZ0 + RZ1) / 2);   // decking
    for (let i = 0; i < BAYS; i++) for (const sx of [-1, 1]) BEAMS.forEach((y, l) => {
      for (const h of [0.6, 1.8]) {
        if (rand() > 0.8) continue;
        const hh = 0.8 + rand() * 0.55;
        pallets.push([xc + sx * 0.7, y + 0.14 + 0.07 + hh / 2, RZ0 + i * BAY + h, 0.98, hh, 1.0, palCols[(rand() * palCols.length) | 0]]);
      }
    });
    shadow(2.6 + 2.6, BAY * BAYS + 2.6, xc, (RZ0 + RZ1) / 2);
  });
  {
    const pm = new InstancedMesh(new BoxGeometry(1, 1, 1), M(0xffffff, 'base'), pallets.length);
    const d = new Matrix4();
    pallets.forEach((p, i) => {
      d.compose(_p.set(p[0], p[1], p[2]), _q.identity(), _s.set(p[3], p[4], p[5]));
      pm.setMatrixAt(i, d); pm.setColorAt(i, new Color(p[6]));
    });
    pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
    groups.base.add(pm);
  }
  // loose pallets staged in front of the dock doors, and two forklifts
  [[-23, -15.2], [-21.5, -15.2], [-14, -14.6], [-9.5, -15.4], [-0.5, -15], [7.5, -14.8], [9, -14.8], [15, -15.4]].forEach(([x, z], i) => {
    bb.box(M(0x4a3b2a, 'base'), 1.1, 0.14, 1.1, x, 0.08, z);
    bb.box(M(palCols[i % palCols.length], 'base'), 1.0, 0.9 + (i % 3) * 0.3, 1.0, x, 0.15 + (0.9 + (i % 3) * 0.3) / 2, z);
    shadow(1.8, 1.8, x, z);
  });
  const forklift = (x, z, ry) => { bb.at(x, 0, z, ry, 1, (b) => {
    const y = M(0xd9a441, 'base');
    b.box(y, 1.1, 0.8, 1.9, 0, 0.7, 0); b.box(cBlack, 1.1, 0.4, 0.6, 0, 0.55, -0.9);
    for (const sx of [-1, 1]) { b.box(cBlack, 0.05, 1.7, 0.05, sx * 0.5, 1.7, 0.55); b.box(cBlack, 0.05, 1.7, 0.05, sx * 0.5, 1.7, -0.5); }
    b.box(y, 1.1, 0.06, 1.2, 0, 2.55, 0.05);
    b.box(cBlack, 0.8, 2.4, 0.1, 0, 1.4, 1.15);
    for (const sx of [-0.3, 0.3]) b.box(cSteel, 0.12, 0.06, 1.2, sx, 0.12, 1.75);
    for (const sx of [-1, 1]) for (const sz of [-0.6, 0.6]) b.cyl(cBlack, 0.3, 0.2, sx * 0.55, 0.3, sz, 0, 0, Math.PI / 2, 12);
  }); shadow(2.4, 3.6, x, z); };
  forklift(-3.6, -12.8, 0.3); forklift(-24.5, -4, -0.6);

  // roof trusses (the roof itself is left off so the room can be seen)
  const cTruss = M(0x3f5362, 'base');
  [-15, -9, -3, 3, 9, 15].forEach((z) => {
    bb.box(cTruss, 2 * W, 0.22, 0.22, 0, 9.55, z); bb.box(cTruss, 2 * W, 0.18, 0.18, 0, TRUSS_Y, z);
    for (let x = -W + 2; x <= W - 2; x += 2) { bb.box(cTruss, 0.1, 0.55, 0.1, x, 9.28, z); }
  });
  // diagonals as thin rotated boxes
  {
    const ang = Math.atan2(0.55, 2);
    [-15, -9, -3, 3, 9, 15].forEach((z) => { for (let x = -W + 2; x < W - 2; x += 4) {
      bb.add(cTruss, new BoxGeometry(2.1, 0.08, 0.08), x + 1, 9.28, z, 0, 0, ang);
      bb.add(cTruss, new BoxGeometry(2.1, 0.08, 0.08), x + 3, 9.28, z, 0, 0, -ang);
    } });
  }

  // mezzanine and office
  const cDeck = M(0x4a5f6e, 'base'), cRail = M(0xd9a441, 'base'), cGlass = M(0x7fb7d6, 'base', { alpha: 0.26 }), cMull = M(0x2d3c46, 'base');
  bb.box(cDeck, 16, 0.3, 12, 20, 3.45, 12); bb.box(cFrame, 16.2, 0.2, 12.2, 20, 3.2, 12);
  for (const x of [13, 20, 27]) for (const z of [7, 17]) bb.box(cFrame, 0.32, 3.3, 0.32, x, 1.65, z);
  shadow(19, 15, 20, 12, 0.025);
  for (let z = 6.2; z <= 17.9; z += 1.95) if (z < 8 || z > 9.6) bb.box(cRail, 0.07, 1.0, 0.07, 12.1, 4.1, z);
  bb.box(cRail, 0.06, 0.06, 12, 12.1, 4.6, 12); bb.box(cRail, 0.05, 0.05, 12, 12.1, 4.35, 12);
  for (let x = 12.1; x <= 28; x += 1.99) bb.box(cRail, 0.07, 1.0, 0.07, x, 4.1, 6.1);
  bb.box(cRail, 16, 0.06, 0.06, 20, 4.6, 6.1); bb.box(cRail, 16, 0.05, 0.05, 20, 4.35, 6.1);
  for (let k = 0; k < 20; k++) { const h = (k + 1) * 0.18; bb.box(cSteel, 0.29, h, 1.2, 6.3 + k * 0.29, h / 2, 8.6); }
  bb.add(cRail, new BoxGeometry(6.4, 0.06, 0.06), 9.1, 2.35, 7.95, 0, 0, Math.atan2(3.4, 5.8));
  // office on the deck: glass on the two visible sides, desks inside
  bb.box(cGlass, 0.06, 2.8, 10, 15, 5.0, 13); bb.box(cGlass, 13, 2.8, 0.06, 21.5, 5.0, 8);
  for (let z = 8; z <= 18; z += 2) bb.box(cMull, 0.1, 2.8, 0.1, 15, 5.0, z);
  for (let x = 15; x <= 28; x += 2.6) bb.box(cMull, 0.1, 2.8, 0.1, x, 5.0, 8);
  bb.box(cMull, 0.12, 0.12, 10, 15, 6.4, 13); bb.box(cMull, 13, 0.12, 0.12, 21.5, 6.4, 8);
  [[18, 11], [18, 15], [23, 11], [23, 15], [26.6, 13]].forEach(([x, z]) => {
    bb.box(M(0x6b7d89, 'base'), 1.7, 0.08, 0.85, x, 4.35, z); bb.box(cBlack, 0.5, 0.35, 0.05, x, 4.7, z - 0.2);
    bb.box(cBlack, 0.5, 0.5, 0.5, x, 3.9, z + 0.85);
  });

  // MDF room (open front and top) and IDF closets
  const cRoom = M(0x58758a, 'base'), cRoomFloor = M(0x4a6577, 'base'), cBoard = M(0x8b7650, 'base');
  bb.box(cRoomFloor, MDF.x1 - MDF.x0, 0.04, MDF.z1 - MDF.z0, (MDF.x0 + MDF.x1) / 2, 0.03, (MDF.z0 + MDF.z1) / 2);
  bb.box(cRoom, MDF.x1 - MDF.x0, MDF.h, 0.2, (MDF.x0 + MDF.x1) / 2, MDF.h / 2, MDF.z0);                       // back wall
  bb.box(cBoard, MDF.x1 - MDF.x0 - 0.4, 2.2, 0.05, (MDF.x0 + MDF.x1) / 2, 2.3, MDF.z0 + 0.13);                                  // plywood backboard
  {   // east wall with the door (a reader goes on its outer face)
    const g0 = MDF.dz - 0.55, g1 = MDF.dz + 0.55;
    bb.box(cRoom, 0.2, MDF.h, g0 - MDF.z0, MDF.x1, MDF.h / 2, (MDF.z0 + g0) / 2); bb.box(cRoom, 0.2, MDF.h, MDF.z1 - g1, MDF.x1, MDF.h / 2, (g1 + MDF.z1) / 2);
    bb.box(cRoom, 0.2, MDF.h - 2.2, 1.1, MDF.x1, (MDF.h + 2.2) / 2, MDF.dz); bb.box(cFrame, 0.26, 0.12, 1.3, MDF.x1, 2.2, MDF.dz);
    bb.box(M(0x8aa0ae, 'base'), 0.08, 2.15, 1.04, MDF.x1 + 0.03, 1.08, MDF.dz);
    bb.box(cCap, 0.3, 0.12, MDF.z1 - MDF.z0, MDF.x1, MDF.h + 0.06, (MDF.z0 + MDF.z1) / 2);
  }
  const idf = (x0, x1, z0, z1, doorZ, openSide) => {   // closet walls 3.0 high, door gap on the west wall
    const hh = 3.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    bb.box(cRoomFloor, x1 - x0, 0.04, z1 - z0, cx, 0.03, cz);
    bb.box(cRoom, 0.2, hh, Math.abs(doorZ - 0.55 - z0), x0, hh / 2, (z0 + doorZ - 0.55) / 2);
    bb.box(cRoom, 0.2, hh, Math.abs(z1 - doorZ - 0.55), x0, hh / 2, (z1 + doorZ + 0.55) / 2);
    bb.box(cRoom, 0.2, 0.8, 1.1, x0, 2.6, doorZ);
    bb.box(M(0x8aa0ae, 'base'), 0.08, 2.1, 1.04, x0 + 0.02, 1.05, doorZ);
    if (openSide !== 'n') bb.box(cRoom, x1 - x0, hh, 0.2, cx, hh / 2, z1);
    if (openSide !== 's') bb.box(cRoom, x1 - x0, hh, 0.2, cx, hh / 2, z0);
  };
  idf(22, 28, -3, 3, 0);              // IDF 1: walls on all sides
  idf(22, 28, -17.9, -12, -15, 's');  // IDF 2: back-right corner, south wall only (the back wall is the building wall)
  shadow(MDF.x1 - MDF.x0 + 3, MDF.z1 - MDF.z0 + 3, (MDF.x0 + MDF.x1) / 2, (MDF.z0 + MDF.z1) / 2, 0.035);

  bb.flush(groups.base);

  /* ================= MDF racks (system "mdf") and IDF racks (system "backbone") ================= */
  const rackFaces = (b, sys, x, z, ry, pattern, rackH, unitH) => {
    const frame = M(0x1a242b, sys), shell = M(0x232f37, sys);
    b.at(x, 0, z, ry, 1, (r) => {
      r.box(shell, 0.62, rackH, 1.0, 0, rackH / 2, -0.5);
      r.box(frame, 0.7, 0.06, 1.08, 0, rackH + 0.03, -0.5); r.box(frame, 0.7, 0.08, 1.08, 0, 0.04, -0.5);
      pattern.forEach((k, i) => {
        const y = rackH - 0.12 - (i + 0.5) * unitH;
        r.box(M(COL[k], sys), 0.56, unitH - 0.012, 0.05, 0, y, 0.02);
        if (k === 'rSwitch' || k === 'rPanel') r.box(M(0x0a1218, sys), 0.46, unitH * 0.4, 0.02, 0, y, 0.055);
      });
    });
  };
  {
    const mb = new Batch();
    const pat1 = ['rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rFw', 'rFw', 'rUps', 'rUps'];
    const pat2 = ['rFiber', 'rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rFw', 'rUps', 'rUps'];
    [-26.4, -25.2, -24.0].forEach((x, i) => rackFaces(mb, 'mdf', x, 12.1, 0, i === 1 ? pat2 : pat1, 2.1, 0.105));
    const lad = M(0x7f909c, 'mdf');
    mb.box(lad, 4.2, 0.06, 0.05, -25.2, 2.42, 11.3); mb.box(lad, 4.2, 0.06, 0.05, -25.2, 2.42, 11.9);
    for (let x = -27; x <= -23.4; x += 0.45) mb.box(lad, 0.04, 0.04, 0.62, x, 2.42, 11.6);
    mb.flush(groups.mdf);
    const ib = new Batch();
    const patI = ['rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch'];
    rackFaces(ib, 'backbone', 27.0, 0.55, -Math.PI / 2, patI, 1.8, 0.14);
    rackFaces(ib, 'backbone', 27.0, -15.5, -Math.PI / 2, patI, 1.8, 0.14);
    ib.flush(groups.backbone);
  }

  /* ================= FIBER: street handhole to the MDF ================= */
  {
    const fb = new Batch();
    const cF = M(COL.fiber, 'fiber', { glow: 0.55 });
    fb.box(M(0x8a97a0, 'fiber'), 1.6, 0.16, 1.6, -27.3, 0.12, 34.6); fb.box(cF, 1.0, 0.04, 1.0, -27.3, 0.22, 34.6);
    fb.pipe(cF, [[-27.3, 0.24, 34.6], [-27.3, 0.24, 16.5], [-27.3, 2.7, 16.5], [-27.3, 2.7, 12.15], [-26.4, 2.7, 12.15], [-26.4, 2.0, 12.15]], 0.2);
    // chevrons along the run so it reads as "coming in"
    for (let z = 31; z > 18; z -= 3.4) fb.add(M(COL.fiber, 'fiber', { glow: 0.55 }), new BoxGeometry(1.0, 0.05, 0.22), -27.3, 0.2, z);
    fb.flush(groups.fiber);
  }

  /* ================= BACKBONE: MDF to IDF 1 and IDF 2 ================= */
  {
    const kb = new Batch();
    const cB = M(COL.fiber, 'backbone', { glow: 0.55 });
    kb.pipe(cB, [[-24.0, 2.3, 11.6], [-24.0, 7.2, 11.6], [-24.0, 7.2, 6.4], [25, 7.2, 6.4], [25, 7.2, 0.6], [26.4, 7.2, 0.6], [26.4, 2.0, 0.6]], 0.19);
    kb.pipe(cB, [[25, 7.2, 0.6], [25, 7.2, -15.5], [26.4, 7.2, -15.5], [26.4, 2.0, -15.5]], 0.19);
    for (let x = -18; x < 24; x += 6) kb.box(M(0x6f8794, 'backbone'), 0.08, 0.9, 0.08, x, 7.65, 6.4);   // simple hangers
    kb.flush(groups.backbone);
  }

  /* ================= TRAY and J-HOOKS ================= */
  {
    const tb = new Batch();
    const cT = M(0xc99a55, 'tray', { glow: 0.45 }), cC = M(0xffd18a, 'tray', { glow: 0.5 }), cR = M(0x9aa7b0, 'tray');
    const ladderX = (x0, x1, z, y) => {   // ladder tray along x
      tb.box(cT, x1 - x0, 0.12, 0.07, (x0 + x1) / 2, y, z - 0.32); tb.box(cT, x1 - x0, 0.12, 0.07, (x0 + x1) / 2, y, z + 0.32);
      for (let x = x0 + 0.3; x < x1; x += 0.5) tb.box(cT, 0.06, 0.05, 0.64, x, y - 0.03, z);
      tb.box(cC, x1 - x0, 0.1, 0.4, (x0 + x1) / 2, y + 0.02, z);
      for (let x = x0 + 2; x < x1; x += 4) tb.box(cR, 0.04, TRUSS_Y - y, 0.04, x, (TRUSS_Y + y) / 2, z - 0.36);
    };
    const ladderZ = (z0, z1, x, y) => {
      tb.box(cT, 0.07, 0.12, z1 - z0, x - 0.32, y, (z0 + z1) / 2); tb.box(cT, 0.07, 0.12, z1 - z0, x + 0.32, y, (z0 + z1) / 2);
      for (let z = z0 + 0.3; z < z1; z += 0.5) tb.box(cT, 0.64, 0.05, 0.06, x, y - 0.03, z);
      tb.box(cC, 0.4, 0.1, z1 - z0, x, y + 0.02, (z0 + z1) / 2);
    };
    ladderX(-25.5, 15.5, 4.6, TRAY_Y);                 // trunk along the front of the racking
    ladderZ(4.6, 10.5, -25.5, TRAY_Y);                 // over to the MDF
    tb.box(cT, 0.07, 5.4, 0.07, -25.82, 5.5, 10.5); tb.box(cT, 0.07, 5.4, 0.07, -25.18, 5.5, 10.5);   // riser down into the MDF
    for (let y = 3.2; y < TRAY_Y; y += 0.5) tb.box(cT, 0.64, 0.05, 0.06, -25.5, y, 10.5);
    // J-hook runs over each aisle: a cable bundle in hooks every 2.4 m
    AISLES.forEach((x) => {
      tb.box(cC, 0.2, 0.2, RZ1 - RZ0 + 7, x, TRAY_Y - 0.03, (RZ0 - 1 + 4.6) / 2);
      for (let z = RZ0 - 0.6; z <= 4.4; z += 2.4) {
        tb.box(cR, 0.05, TRUSS_Y - TRAY_Y - 0.2, 0.05, x, (TRUSS_Y + TRAY_Y) / 2 - 0.02, z);
        tb.box(cT, 0.5, 0.06, 0.08, x, TRAY_Y - 0.22, z); tb.box(cT, 0.06, 0.26, 0.08, x - 0.22, TRAY_Y - 0.1, z); tb.box(cT, 0.06, 0.26, 0.08, x + 0.22, TRAY_Y - 0.1, z);
        tb.box(cT, 0.14, 0.06, 0.08, x - 0.17, TRAY_Y + 0.04, z);
      }
      tb.box(cT, 0.5, 0.06, 0.4, x, TRAY_Y - 0.22, 4.6);
    });
    tb.flush(groups.tray);
  }

  /* ================= WIFI: high-bay access points above the aisles ================= */
  const apPoints = [];
  AISLES.forEach((x) => [-8, -1].forEach((z) => apPoints.push([x, z])));
  {
    const wb = new Batch();
    const cA = M(0xf1f6f8, 'wifi', { glow: 0.2 }), cG = M(COL.wireless, 'wifi', { glow: 0.7 }), cD = M(0x2d3a42, 'wifi');
    const cov = M(COL.wireless, 'wifi', { alpha: 0.2, basic: true, map: discTex });
    const cone = M(COL.wireless, 'wifi', { alpha: 0.07, basic: true });
    apPoints.forEach(([x, z]) => {
      const y = 7.4;
      wb.box(cD, 0.04, TRAY_Y - 0.25 - y, 0.04, x, (TRAY_Y - 0.25 + y) / 2, z);
      wb.cyl(cA, 0.62, 0.22, x, y, z, 0, 0, 0, 20);
      wb.cyl(cG, 0.64, 0.07, x, y - 0.08, z, 0, 0, 0, 20);
      wb.add(cA, new CylinderGeometry(0.3, 0.46, 0.22, 16), x, y + 0.2, z);
      for (const s of [-1, 1]) { wb.box(cD, 0.07, 0.55, 0.07, x + s * 0.55, y + 0.32, z, 0); }
      wb.add(cov, new CircleGeometry(5.2, 40), x, 0.07, z, -Math.PI / 2, 0, 0);
      wb.add(cone, new CylinderGeometry(0.5, 5.2, y, 28, 1, true), x, y / 2, z);
    });
    wb.flush(groups.wifi);
  }

  /* ================= CAMERAS: dock doors and aisle ends ================= */
  {
    const cb = new Batch();
    const cP = M(COL.surveillance, 'cams', { glow: 0.55 }), cBody = M(0xe9e4f3, 'cams', { glow: 0.2 }), cLens = M(0x1a1426, 'cams');
    const fan = M(COL.surveillance, 'cams', { alpha: 0.22, basic: true });
    const cam = (x, y, z, ry, tilt) => cb.at(x, y, z, ry, 1.7, (b) => {   // drawn about 1.7x life size so it reads at a distance
      b.box(cBody, 0.34, 0.3, 0.8, 0, 0, 0.1); b.box(cP, 0.36, 0.1, 0.5, 0, 0.18, 0.05);
      b.ball(cLens, 0.17, 0, -0.02, 0.52); b.box(cP, 0.2, 0.2, 0.06, 0, -0.02, 0.5);
    });
    [-16, -8, 0, 8].forEach((x) => {   // on the back wall, covering the docks
      cb.box(cLens, 0.12, 0.5, 0.5, x, 5.55, -D + 0.3);
      cam(x, 5.3, -D + 0.9, 0);
      cb.add(fan, floorShape([[x, -D + 0.5], [x - 7.4, -D + 9.5], [x + 7.4, -D + 9.5]]), 0, 0.075, 0);
    });
    AISLES.forEach((x) => {            // on a drop from the roof, at the aisle ends, looking down the aisle
      cb.box(cLens, 0.12, TRUSS_Y - 6.8, 0.12, x, (TRUSS_Y + 6.8) / 2, 4.5);
      cam(x, 6.6, 4.4, Math.PI);
      cb.add(fan, floorShape([[x, 4.3], [x - 2.6, RZ0 - 0.5], [x + 2.6, RZ0 - 0.5]]), 0, 0.075, 0);
    });
    cb.flush(groups.cams);
  }

  /* ================= ACCESS CONTROL: readers on the man-doors and the MDF door ================= */
  {
    const ab = new Batch();
    const cR = M(0x27323a, 'access'), cL = M(COL.access, 'access', { glow: 0.9 }), cHalo = M(COL.access, 'access', { alpha: 0.3, basic: true });
    const reader = (x, y, z, ry) => ab.at(x, y, z, ry, 4.5, (b) => {   // local +z points away from the wall
      b.box(cR, 0.22, 0.34, 0.08, 0, 0, 0.04); b.box(cL, 0.14, 0.05, 0.03, 0, 0.1, 0.095); b.box(cL, 0.08, 0.08, 0.03, 0, -0.04, 0.095);
      b.add(cHalo, new CircleGeometry(0.5, 24), 0, 0, 0.02);
    });
    reader(23.3, 1.3, -D + 0.04, 0);                                    // back-wall man-door
    reader(-W + 0.04, 1.3, -4.7, Math.PI / 2);                          // west-wall man-door
    reader(W - 0.04, 1.3, -9.3, -Math.PI / 2);                          // east-wall man-door
    reader(MDF.x1 + 0.1, 1.3, MDF.dz + 1.0, Math.PI / 2);                       // MDF door, outside face
    ab.flush(groups.access);
  }

  /* labels (small billboards) */
  const labels = [];
  function label(text, x, y, z, sys, grp) {
    const c = mkCanvas(256, 80), g = c.getContext('2d');
    g.fillStyle = 'rgba(11,20,25,.88)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 248, 72, 16) : g.rect(4, 4, 248, 72); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#' + COL[grp || 'fiber'].toString(16).padStart(6, '0'); g.stroke();
    g.fillStyle = '#f4f8fa'; g.font = '700 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 42);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    const sp = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    sp.position.set(x, y, z); sp.renderOrder = 20; groups[sys].add(sp);
    labels.push(sp);
  }
  label('MDF', -24.5, 4.9, 14.5, 'mdf'); label('IDF 1', 25, 4.4, 0, 'backbone'); label('IDF 2', 25, 4.4, -15, 'backbone'); label('Fiber in', -27.3, 2.6, 35, 'fiber');

  /* ---------- system state: visible, dimmed, lit ---------- */
  const st = {};
  for (const k of Object.keys(SYS_STEP)) st[k] = { dim: 0, hi: 0, tDim: 0, tHi: 0 };
  function applyLook() {
    for (const r of reg) {
      const s = st[r.sys], m = r.m;
      m.color.copy(r.base).lerp(DARK, s.dim);
      if (m.emissive) m.emissive.copy(r.base).multiplyScalar(s.hi * r.glow);
      if (r.alpha !== undefined) m.opacity = r.alpha * (1 - s.dim * 0.55) * (1 + s.hi * 0.5);
    }
  }
  function targets(step) {
    const act = STEP_SYS[step];
    for (const k of Object.keys(st)) {
      const s = st[k];
      groups[k].visible = SYS_STEP[k] <= step;
      s.tDim = act ? (k === act ? 0 : 0.62) : 0;
      s.tHi = k === 'base' ? 0 : act ? (k === act ? 1 : 0) : step >= STEPS ? 0.3 : 0;
    }
  }

  /* ---------- camera: spherical orbit around the pose target, clamped; glides between poses ---------- */
  const cam = { tx: 0, ty: 0, tz: 0, dist: 90, az: 0, el: 30 };
  const goal = Object.assign({}, cam);
  let aspect = 1, fit = 1;
  function setPose(p) { goal.tx = p[0]; goal.ty = p[1]; goal.tz = p[2]; goal.dist = p[3]; goal.az = p[4]; goal.el = p[5]; }
  function place() {
    const d = cam.dist * fit, a = rad(cam.az), e = rad(clamp(cam.el, LIMIT.el[0], LIMIT.el[1]));
    camera.position.set(cam.tx + Math.sin(a) * Math.cos(e) * d, Math.max(1.5, cam.ty + Math.sin(e) * d), cam.tz + Math.cos(a) * Math.cos(e) * d);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    const k = cam.dist * fit * 0.05;
    labels.forEach((l) => l.scale.set(k, k * 0.3125, 1));
  }

  let step = 1, rafId = 0, last = 0, size = [0, 0], dpr = 1, alive = true, drag = 0;
  const SPEED = 5.2;   // 1/s: the glide settles in about a second
  function setSize(w, h, ratio) {
    ratio = Math.min(ratio || 1, maxDpr);
    if (!w || !h || (w === size[0] && h === size[1] && ratio === dpr)) return;
    size = [w, h]; dpr = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    aspect = w / h; fit = Math.max(1, 1 / aspect) * (aspect > 1.4 ? 0.88 : 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    wake();
  }
  function frameTick(now) {
    rafId = 0;
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    const k = reduced ? 1 : 1 - Math.exp(-SPEED * dt);
    if (!drag) {
      for (const key of ['tx', 'ty', 'tz', 'dist', 'az', 'el']) {
        const d = goal[key] - cam[key];
        if (Math.abs(d) > 0.004) { cam[key] += d * k; moving = true; } else cam[key] = goal[key];
      }
    } else moving = true;
    const kl = reduced ? 1 : 1 - Math.exp(-7 * dt);
    for (const key of Object.keys(st)) {
      const s = st[key];
      for (const f of ['dim', 'hi']) {
        const t = f === 'dim' ? s.tDim : s.tHi, d = t - s[f];
        if (Math.abs(d) > 0.004) { s[f] += d * kl; moving = true; } else s[f] = t;
      }
    }
    applyLook();
    place();
    renderer.render(scene, camera);
    if (moving && alive) rafId = raf(frameTick);
  }
  function wake() { if (!rafId && alive) { last = performance.now(); rafId = raf(frameTick); } }

  function setState(n) {
    step = clamp(n | 0, 1, STEPS);
    setPose(POSE[step]);
    targets(step);
    wake();
  }

  /* ---------- orbit: drag to rotate, two fingers to pinch. Input arrives as calls (the page forwards its pointer events) ---------- */
  const ptrs = new Map();
  let pinch = 0;
  function stopGlide() { Object.assign(goal, cam); }
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
        cam.az -= dx * 0.35;
        cam.el = clamp(cam.el + dy * 0.3, LIMIT.el[0], LIMIT.el[1]);
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
  setState(options.step || 1);
  // First paint without the glide: start parked on the first pose
  Object.assign(cam, goal);
  for (const key of Object.keys(st)) { st[key].dim = st[key].tDim; st[key].hi = st[key].tHi; }
  applyLook(); place(); renderer.render(scene, camera);

  return {
    setState, setSize, pointer, wheel,
    /* test hooks: jump the camera (tx, ty, tz, dist metres, az/el degrees) and redraw */
    pose: (p) => { Object.assign(cam, p); Object.assign(goal, p); place(); renderer.render(scene, camera); return Object.assign({}, cam); },
    steps: STEPS,
    dispose() {
      alive = false; if (rafId) caf(rafId);
      renderer.dispose();
    }
  };
}
