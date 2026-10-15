/* How We Build, v4 warehouse: an empty building shell where the cabling systems are the only content. Built in code (no 3D asset
   file, no textures, no HDRI). Flat vector look: plain coloured faces, soft light. The shell has no roof and no front wall (walls are
   single-sided and face inward), so the camera always looks in; walls between the camera and the room simply vanish.
   Systems (fiber, MDF, backbone, tray, wifi, cams, access) are separate groups. `setState(step)` shows the systems up to that step,
   highlights the current one, dims the rest and glides the camera to that step's own pose (eased, about 1 s; a cut under reduced motion).
   Render on demand: frames are drawn only while something moves.
   This file touches no DOM: it draws into the canvas it is given (a transferred OffscreenCanvas inside a worker, or a normal
   canvas on the page) and takes size and pointer input as calls. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry,
  SphereGeometry, CircleGeometry, PlaneGeometry, ShapeGeometry, Shape, Path, HemisphereLight, DirectionalLight, CanvasTexture,
  SRGBColorSpace, Color, Vector3, Matrix4, Quaternion, Euler, Sprite, SpriteMaterial, BufferGeometry, Float32BufferAttribute, DoubleSide
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ---------- layout (metres; x east, z toward the viewer, y up) ---------- */
const W = 28, D = 18, H = 9.6;                       // half width, half depth, wall height
const DOCKS = [-20, -12, -4, 4, 12];                 // dock roll-up doors on the back wall
const TRAY_Y = 8.2, TRUSS_Y = 9.0;
const HOOK = 1.5;                                    // J-hook spacing, 1.5 m (5 ft)
const AP_Y = 7.4;                                    // high-bay access point height
const AP_X = [-20, -2, 16], AP_Z = [-9, 9];          // 6 access points, 18 m (59 ft) apart both ways
const READER_Y = 1.1;                                // card reader height
const MDF = { x0: -28, x1: -21, z0: 11, z1: 18, h: 3.6, dz: 14.5 };   // MDF room, door centre z

/* systems: the step each first appears on. Overlays (the Wi-Fi coverage hint, the camera views) show on their own step only. */
const SYS_STEP = { base: 0, roof: 0, fiber: 2, mdf: 2, backbone: 3, tray: 4, wifi: 4, cams: 4, access: 4, wifiCov: 5, camCone: 6 };
const STEP_SYS = { 2: ['fiber', 'mdf'], 3: ['backbone'], 4: ['tray'], 5: ['wifi', 'wifiCov'], 6: ['cams', 'camCone'], 7: ['access'] };
const DEVICES = { wifi: 1, cams: 1, access: 1 };   // shown (dimmed) on the tray step as the things the drops feed
const STEPS = 8;
const COL = {   // site palette (stage.css) for the systems; Field Ops RACK_COL for the rack gear
  fiber: 0x53c3df, cabling: 0xe0a85a, wireless: 0x7fe3a0, surveillance: 0xc79bff, access: 0xff9a6b,
  rFiber: 0x7d55c7, rHm: 0x39424c, rPanel: 0x2f6fb0, rSwitch: 0x1f8a5b, rFw: 0xa3424a, rUps: 0xb5651d
};
const DARK = new Color(0x0b1419);

/* camera poses, one per step: t = target [x, y, z], d = distance (m), az / el = degrees. `fit` poses show the whole building,
   so their distance is fitted to the canvas's aspect; `nar` backs the others off on a squarer canvas (phones). */
const POSE = {
  1: { t: [0, 3.8, 0], d: 100, az: 30, el: 38, fit: 1 },                  // high 3/4 isometric, roof removed
  2: { t: [-24.5, 2.4, 15], d: 27, az: 38, el: 9, nar: 1.3 },                        // low, at the entrance wall: conduit in, MDF door and room
  3: { t: [0, 4, 1], d: 80, az: 6, el: 22, fit: 1 },                      // cutaway along the backbone, MDF to IDFs
  4: { t: [-3, 7.4, -2], d: 36, az: 26, el: -8, nar: 1.3 },                         // from below, up and along the tray and J-hook runs
  5: { t: [0, 0, 0], d: 90, az: 0, el: 86, fit: 1 },                      // top-down plan
  6: { t: [-4, 2.5, -9], d: 50, az: 52, el: 26, nar: 1.3 },                         // corner view of the camera views
  7: { t: [18.6, 1.3, -17.96], d: 11, az: 14, el: 1.6 },                   // eye level (about 1.6 m) at a door, reader at 1.1 m
  8: { t: [0, 3.8, 0], d: 100, az: 30, el: 38, fit: 1 }                   // back to the overview, everything on
};
const LIMIT = { el: [-10, 86], dist: [8, 320] };
const GLIDE = 1.0;   // seconds

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

  /* ================= BASE: ground, shell, doors, MDF room and IDF closets (nothing else on the floor) ================= */
  const bb = new Batch();
  const cGround = M(0x0c151a, 'base'), cSlab = M(0x35495a, 'base'), cJoint = M(0x1c2a32, 'base');
  const cWall = M(0x4a6479, 'base'), cCap = M(0x86a3b6, 'base'), cPlinth = M(0x5d788b, 'base');
  const cAsphalt = M(0x172630, 'base'), cWalk = M(0x2a3a45, 'base');
  const cSteel = M(0x7f909c, 'base'), cDoor = M(0xaab8c1, 'base'), cSlat = M(0x8a9aa5, 'base'), cBlack = M(0x1b242a, 'base');
  const cFrame = M(0x2b3942, 'base');

  bb.box(cGround, 300, 0.2, 220, 0, -0.3, 6);
  bb.box(cSlab, 2 * W + 1.2, 0.3, 2 * D + 1.2, 0, -0.15, 0);
  for (let x = -21; x <= 21; x += 7) bb.box(cJoint, 0.06, 0.012, 2 * D, x, 0.008, 0);
  for (let z = -12; z <= 12; z += 6) bb.box(cJoint, 2 * W, 0.012, 0.06, 0, 0.008, z);
  // apron, sidewalk and street on the front side (flat; the fiber comes in from the street)
  bb.box(cAsphalt, 90, 0.1, 15, 4, -0.04, 27);
  bb.box(cWalk, 300, 0.12, 2.4, 0, -0.04, 34.6);
  bb.box(cAsphalt, 300, 0.1, 13, 0, -0.05, 42);

  // walls: single-sided planes facing inward, with openings. Seen from outside they are invisible.
  function wall(len, rotY, px, pz, holes) {
    const s = new Shape();
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, H); s.lineTo(-len / 2, H); s.closePath();
    holes.forEach((h) => { const p = new Path(); p.moveTo(h[0], h[1]); p.lineTo(h[0], h[3]); p.lineTo(h[2], h[3]); p.lineTo(h[2], h[1]); p.closePath(); s.holes.push(p); });
    const g = new ShapeGeometry(s); g.rotateY(rotY); g.translate(px, 0, pz);
    const m = new Mesh(g, cWall); groups.base.add(m);
  }
  const manHole = (v) => [v - 0.6, 0, v + 0.6, 2.4];
  wall(2 * W, 0, 0, -D, DOCKS.map((x) => [x - 1.7, 0, x + 1.7, 4.4]).concat([manHole(18)]));
  wall(2 * D, Math.PI / 2, -W, 0, [manHole(6)]);          // west wall: local x = -z
  wall(2 * D, -Math.PI / 2, W, 0, [manHole(-8)]);         // east wall: local x = +z
  wall(2 * W, Math.PI, 0, D, []);                         // front wall (never seen from the front)
  // plinth round all four sides, and a cap on the three visible walls
  bb.box(cPlinth, 2 * W + 0.4, 0.5, 0.4, 0, 0.25, -D - 0.2); bb.box(cPlinth, 2 * W + 0.4, 0.5, 0.4, 0, 0.25, D + 0.2);
  bb.box(cPlinth, 0.4, 0.5, 2 * D, -W - 0.2, 0.25, 0); bb.box(cPlinth, 0.4, 0.5, 2 * D, W + 0.2, 0.25, 0);
  bb.box(cCap, 2 * W + 0.4, 0.3, 0.45, 0, H + 0.1, -D - 0.2); bb.box(cCap, 0.45, 0.3, 2 * D + 0.4, -W - 0.2, H + 0.1, 0); bb.box(cCap, 0.45, 0.3, 2 * D + 0.4, W + 0.2, H + 0.1, 0);
  for (let x = -W + 4; x < W; x += 8) bb.box(M(0x3d566a, 'base'), 0.5, H, 0.3, x, H / 2, -D + 0.15);   // pilasters on the back wall
  for (let z = -D + 4; z < D; z += 8) { bb.box(M(0x3d566a, 'base'), 0.3, H, 0.5, -W + 0.15, H / 2, z); bb.box(M(0x3d566a, 'base'), 0.3, H, 0.5, W - 0.15, H / 2, z); }

  // dock doors: closed roll-ups (no bumpers, levelers or trailers)
  DOCKS.forEach((x) => {
    bb.box(cFrame, 3.7, 0.3, 0.3, x, 4.55, -D + 0.12);
    bb.box(cFrame, 0.22, 4.4, 0.3, x - 1.78, 2.2, -D + 0.12); bb.box(cFrame, 0.22, 4.4, 0.3, x + 1.78, 2.2, -D + 0.12);
    bb.box(cDoor, 3.4, 4.3, 0.1, x, 2.15, -D + 0.06);
    for (let k = 0; k < 7; k++) bb.box(cSlat, 3.4, 0.07, 0.14, x, 0.45 + k * 0.6, -D + 0.12);
  });
  // man-doors (the back-wall one sits at x = 18, clear of the IDF 2 closet)
  const manDoor = (x, y, z, ry) => bb.at(x, y, z, ry, 1, (b) => {
    b.box(cFrame, 1.4, 0.18, 0.2, 0, 2.43, 0); b.box(cFrame, 0.16, 2.4, 0.2, -0.64, 1.2, 0); b.box(cFrame, 0.16, 2.4, 0.2, 0.64, 1.2, 0);
    b.box(M(0x8aa0ae, 'base'), 1.12, 2.3, 0.08, 0, 1.15, 0.04);
    b.box(cBlack, 0.06, 0.4, 0.1, 0.4, 1.0, 0.12);
  });
  manDoor(18, 0, -D + 0.1, 0); manDoor(-W + 0.1, 0, -6, Math.PI / 2); manDoor(W - 0.1, 0, -8, -Math.PI / 2);

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

  // roof trusses (the roof itself is left off): shown only where a view needs them, for the J-hooks to hang from
  {
    const rb = new Batch();
    const cTruss = M(0x3f5362, 'roof');
    const TZ = [-15, -9, -3, 3, 9, 15];
    TZ.forEach((z) => {
      rb.box(cTruss, 2 * W, 0.22, 0.22, 0, 9.55, z); rb.box(cTruss, 2 * W, 0.18, 0.18, 0, TRUSS_Y, z);
      for (let x = -W + 2; x <= W - 2; x += 2) rb.box(cTruss, 0.1, 0.55, 0.1, x, 9.28, z);
    });
    const ang = Math.atan2(0.55, 2);
    TZ.forEach((z) => { for (let x = -W + 2; x < W - 2; x += 4) {
      rb.add(cTruss, new BoxGeometry(2.1, 0.08, 0.08), x + 1, 9.28, z, 0, 0, ang);
      rb.add(cTruss, new BoxGeometry(2.1, 0.08, 0.08), x + 3, 9.28, z, 0, 0, -ang);
    } });
    rb.flush(groups.roof);
  }

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
    const pat1 = ['rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rFw', 'rFw', 'rUps', 'rUps'];
    const pat2 = ['rFiber', 'rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rFw', 'rUps', 'rUps'];
    [-26.4, -25.2, -24.0].forEach((x, i) => rackFaces(mb, 'mdf', x, 12.1, 0, i === 1 ? pat2 : pat1, 2.1, 0.1));
    const lad = M(0x7f909c, 'mdf');
    mb.box(lad, 4.2, 0.06, 0.05, -25.2, 2.42, 11.3); mb.box(lad, 4.2, 0.06, 0.05, -25.2, 2.42, 11.9);
    for (let x = -27; x <= -23.4; x += 0.45) mb.box(lad, 0.04, 0.04, 0.62, x, 2.42, 11.6);
    mb.flush(groups.mdf);
    const ib = new Batch();
    const patI = ['rFiber', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm', 'rPanel', 'rHm', 'rSwitch', 'rHm'];
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
    kb.pipe(cB, [[25, 7.2, 0.6], [25, 7.2, -15.5], [25, 2.0, -15.5]], 0.19);
    for (let x = -18; x < 24; x += 6) kb.box(M(0x6f8794, 'backbone'), 0.08, 0.9, 0.08, x, 7.65, 6.4);   // simple hangers
    kb.flush(groups.backbone);
  }

  /* ================= TRAY and J-HOOKS: trunk tray, hooked runs, a drop to every device ================= */
  const WALL_RUN_Z = -D + 0.6, WALL_RUN_XW = -W + 0.6, WALL_RUN_XE = W - 0.6;
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
    ladderX(-25.5, 15.5, 4.6, TRAY_Y);                 // trunk along the middle of the building
    ladderZ(4.6, 10.5, -25.5, TRAY_Y);                 // over to the MDF
    tb.box(cT, 0.07, 5.4, 0.07, -25.82, 5.5, 10.5); tb.box(cT, 0.07, 5.4, 0.07, -25.18, 5.5, 10.5);   // riser down into the MDF
    for (let y = 3.2; y < TRAY_Y; y += 0.5) tb.box(cT, 0.64, 0.05, 0.06, -25.5, y, 10.5);
    // J-hook runs: a cable bundle in a hook every 1.5 m (5 ft). Along z at x (hung from the trusses), along x at z or against a wall.
    const hookZ = (x, za, zb, wallX) => {
      const lo = Math.min(za, zb), hi = Math.max(za, zb);
      tb.box(cC, 0.2, 0.2, hi - lo, x, TRAY_Y - 0.03, (lo + hi) / 2);
      for (let z = za; za < zb ? z <= zb + 0.01 : z >= zb - 0.01; z += za < zb ? HOOK : -HOOK) {
        if (wallX === undefined) tb.box(cR, 0.05, TRUSS_Y - TRAY_Y - 0.2, 0.05, x, (TRUSS_Y + TRAY_Y) / 2 - 0.02, z);
        else tb.box(cR, 0.5, 0.05, 0.05, x + (wallX < 0 ? -0.25 : 0.25), TRAY_Y - 0.22, z);
        tb.box(cT, 0.5, 0.06, 0.08, x, TRAY_Y - 0.22, z); tb.box(cT, 0.06, 0.26, 0.08, x - 0.22, TRAY_Y - 0.1, z); tb.box(cT, 0.06, 0.26, 0.08, x + 0.22, TRAY_Y - 0.1, z);
        tb.box(cT, 0.14, 0.06, 0.08, x - 0.17, TRAY_Y + 0.04, z);
      }
    };
    const hookX = (z, xa, xb) => {
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      tb.box(cC, hi - lo, 0.2, 0.2, (lo + hi) / 2, TRAY_Y - 0.03, z);
      for (let x = xa; x <= xb + 0.01; x += HOOK) {
        tb.box(cR, 0.05, 0.05, 0.5, x, TRAY_Y - 0.22, z - 0.25);
        tb.box(cT, 0.08, 0.06, 0.5, x, TRAY_Y - 0.22, z); tb.box(cT, 0.08, 0.26, 0.06, x, TRAY_Y - 0.1, z - 0.22); tb.box(cT, 0.08, 0.26, 0.06, x, TRAY_Y - 0.1, z + 0.22);
        tb.box(cT, 0.08, 0.06, 0.14, x, TRAY_Y + 0.04, z - 0.17);
      }
    };
    AP_X.forEach((x) => {
      hookZ(x, 4.6, AP_Z[0]);                           // trunk to the back row of access points
      hookZ(x, 4.6, AP_Z[1]);                           // trunk to the front row
      tb.box(cT, 0.5, 0.06, 0.4, x, TRAY_Y - 0.22, 4.6);
    });
    hookZ(AP_X[0], AP_Z[0], WALL_RUN_Z);                // on to the back wall
    hookX(WALL_RUN_Z, WALL_RUN_XW, WALL_RUN_XE);        // along the back wall: cameras and the back door
    hookZ(WALL_RUN_XW, WALL_RUN_Z, -4.7, -1);           // down the west wall to its door
    hookZ(WALL_RUN_XE, WALL_RUN_Z, -9.3, 1);            // down the east wall to its door
    // drops: a cable from the run to each device
    const cableDrop = (x, y0, y1, z) => tb.box(cC, 0.09, y0 - y1, 0.09, x, (y0 + y1) / 2, z);
    AP_X.forEach((x) => AP_Z.forEach((z) => cableDrop(x, TRAY_Y - 0.1, AP_Y + 0.5, z)));
    [-16, -8, 0, 8].forEach((x) => cableDrop(x, TRAY_Y - 0.1, 5.7, WALL_RUN_Z));
    cableDrop(19.3, TRAY_Y - 0.1, READER_Y + 0.3, -D + 0.12);
    cableDrop(-W + 0.12, TRAY_Y - 0.1, READER_Y + 0.3, -4.7);
    cableDrop(W - 0.12, TRAY_Y - 0.1, READER_Y + 0.3, -9.3);
    tb.flush(groups.tray);
  }

  /* ================= WIFI: 6 high-bay access points in an even grid; the coverage hint is a separate, step-only group ================= */
  {
    const wb = new Batch();
    const cA = M(0xf1f6f8, 'wifi', { glow: 0.2 }), cG = M(COL.wireless, 'wifi', { glow: 0.7 }), cD = M(0x2d3a42, 'wifi');
    AP_X.forEach((x) => AP_Z.forEach((z) => {
      wb.box(cD, 0.05, TRAY_Y - 0.5 - AP_Y, 0.05, x, (TRAY_Y - 0.5 + AP_Y) / 2, z);
      wb.at(x, AP_Y, z, 0, 1.8, (b) => {   // drawn about 1.8x life size so it reads from across the building
        b.cyl(cA, 0.62, 0.22, 0, 0, 0, 0, 0, 0, 20);
        b.cyl(cG, 0.64, 0.07, 0, -0.08, 0, 0, 0, 0, 20);
        b.add(cA, new CylinderGeometry(0.3, 0.46, 0.22, 16), 0, 0.2, 0);
      });
    }));
    wb.flush(groups.wifi);
    const cb = new Batch();
    const cov = M(COL.wireless, 'wifiCov', { alpha: 0.2, basic: true, map: discTex });
    AP_X.forEach((x) => AP_Z.forEach((z) => cb.add(cov, new CircleGeometry(11, 48), x, 0.07, z, -Math.PI / 2, 0, 0)));
    cb.flush(groups.wifiCov);
  }

  /* ================= CAMERAS: along the back wall; each camera's view is a faint wedge (separate, step-only group) ================= */
  {
    const cb = new Batch();
    const cP = M(COL.surveillance, 'cams', { glow: 0.55 }), cBody = M(0xe9e4f3, 'cams', { glow: 0.2 }), cLens = M(0x1a1426, 'cams');
    const cam = (x, y, z, ry) => cb.at(x, y, z, ry, 1.7, (b) => {   // drawn about 1.7x life size so it reads at a distance
      b.box(cBody, 0.34, 0.3, 0.8, 0, 0, 0.1); b.box(cP, 0.36, 0.1, 0.5, 0, 0.18, 0.05);
      b.ball(cLens, 0.17, 0, -0.02, 0.52); b.box(cP, 0.2, 0.2, 0.06, 0, -0.02, 0.5);
    });
    const vb = new Batch();
    const fan = M(COL.surveillance, 'camCone', { alpha: 0.2, basic: true });
    const wedgeMat = M(COL.surveillance, 'camCone', { alpha: 0.07, basic: true });
    wedgeMat.side = DoubleSide;
    [-16, -8, 0, 8].forEach((x) => {
      cb.box(cLens, 0.12, 0.5, 0.5, x, 5.55, -D + 0.3);
      cam(x, 5.3, -D + 0.9, 0);
      // view: a wedge from the lens to a trapezoid on the floor, 3.2 m to 12 m out from the wall
      const ax = x, ay = 5.3, az = -D + 0.9, n0 = -D + 3.2, n1 = -D + 12, w0 = 1.6, w1 = 4.2;
      vb.add(fan, floorShape([[x - w0, n0], [x + w0, n0], [x + w1, n1], [x - w1, n1]]), 0, 0.075, 0);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute([ax, ay, az, x - w0, 0.08, n0, x + w0, 0.08, n0, x + w1, 0.08, n1, x - w1, 0.08, n1], 3));
      g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
      vb.add(wedgeMat, g);
    });
    cb.flush(groups.cams);
    vb.flush(groups.camCone);
  }

  /* ================= ACCESS CONTROL: readers at 1.1 m on the man-doors and the MDF door ================= */
  {
    const ab = new Batch();
    const cR = M(0x27323a, 'access'), cL = M(COL.access, 'access', { glow: 0.9 }), cHalo = M(COL.access, 'access', { alpha: 0.16, basic: true });
    const reader = (x, y, z, ry) => ab.at(x, y, z, ry, 3, (b) => {   // local +z points away from the wall; drawn about 3x life size
      b.box(cR, 0.22, 0.34, 0.08, 0, 0, 0.04); b.box(cL, 0.14, 0.05, 0.03, 0, 0.1, 0.095); b.box(cL, 0.08, 0.08, 0.03, 0, -0.04, 0.095);
      b.add(cHalo, new CircleGeometry(0.26, 24), 0, 0, 0.02);
    });
    reader(19.3, READER_Y, -D + 0.04, 0);                                    // back-wall man-door
    reader(-W + 0.04, READER_Y, -4.7, Math.PI / 2);                          // west-wall man-door
    reader(W - 0.04, READER_Y, -9.3, -Math.PI / 2);                          // east-wall man-door
    reader(MDF.x1 + 0.1, READER_Y, MDF.dz + 1.0, Math.PI / 2);               // MDF door, outside face
    ab.flush(groups.access);
  }

  /* labels (small billboards) */
  const labels = [];
  function label(text, x, y, z, sys, grp, wide) {
    const w = wide ? 512 : 256, c = mkCanvas(w, 80), g = c.getContext('2d');
    g.fillStyle = 'rgba(11,20,25,.88)'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, 72, 16) : g.rect(4, 4, w - 8, 72); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#' + COL[grp || 'fiber'].toString(16).padStart(6, '0'); g.stroke();
    g.fillStyle = '#f4f8fa'; g.font = '700 38px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 42);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    const sp = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    sp.position.set(x, y, z); sp.renderOrder = 20; sp.userData.w = wide ? 2 : 1; groups[sys].add(sp);
    labels.push(sp);
  }
  label('MDF', -24.5, 4.9, 14.5, 'mdf'); label('IDF 1', 25, 4.4, 0, 'backbone'); label('IDF 2', 25, 4.4, -15, 'backbone'); label('Fiber in', -27.3, 2.6, 35, 'fiber');
  label('Illustrative coverage', 0, 0.6, 0, 'wifiCov', 'wireless', true);

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
      const s = st[k], on = act && act.indexOf(k) >= 0;
      // overlays show on their own step only; the roof trusses only where the J-hooks need something to hang from
      groups[k].visible = k === 'roof' ? step === 4 : k === 'wifiCov' ? step === 5 : k === 'camCone' ? step === 6 : SYS_STEP[k] <= step;
      s.tDim = act ? (on ? 0 : DEVICES[k] && step === 4 ? 0.3 : 0.62) : 0;
      s.tHi = k === 'base' || k === 'roof' ? 0 : act ? (on ? 1 : 0) : step >= STEPS ? 0.3 : 0;
    }
  }

  /* ---------- camera: spherical orbit around the pose target, clamped; each step eases to its own pose ---------- */
  const cam = { tx: 0, ty: 0, tz: 0, dist: 90, az: 0, el: 30 };
  const goal = Object.assign({}, cam);
  let aspect = 1, fit = 1, fitAspect = 0, tween = null;
  /* Distance at which the whole building (walls, MDF room) sits inside the view for this target and angle, at this aspect. */
  const _c = new Vector3(), _f = new Vector3(), _r = new Vector3(), _u = new Vector3();
  function fitDist(tx, ty, tz, az, el, a) {
    const ra = rad(az), re = rad(clamp(el, LIMIT.el[0], LIMIT.el[1]));
    _f.set(-Math.sin(ra) * Math.cos(re), -Math.sin(re), -Math.cos(ra) * Math.cos(re));   // view direction
    _r.set(Math.cos(ra), 0, -Math.sin(ra));                                              // screen right
    _u.crossVectors(_r, _f);                                                             // screen up
    const th = Math.tan(rad(camera.fov) / 2), tw = th * a;
    let need = 0;
    for (const x of [-W, W]) for (const y of [0, H]) for (const z of [-D, D]) {
      _c.set(x - tx, y - ty, z - tz);
      const px = _c.dot(_r), py = _c.dot(_u), pz = _c.dot(_f);   // camera at distance d: depth = d + pz
      // need |px| <= m * tw * (d + pz) and |py| <= m * th * (d + pz)
      need = Math.max(need, Math.abs(px) / (0.94 * tw) - pz, Math.abs(py) / (0.94 * th) - pz);
    }
    return need;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // easeInOutCubic
  function setPose(p, snap) {
    goal.tx = p.t[0]; goal.ty = p.t[1]; goal.tz = p.t[2]; goal.dist = p.d * (p.nar && aspect < 1.3 ? p.nar : 1); goal.az = p.az; goal.el = p.el;
    if (p.fit) {
      if (aspect < 0.8) goal.el = Math.max(goal.el, 50);   // portrait: look down more so the depth uses the tall canvas
      goal.dist = fitDist(goal.tx, goal.ty, goal.tz, goal.az, goal.el, aspect) / fit;   // place() multiplies by fit again
    }
    goal.az = cam.az + ((((goal.az - cam.az) % 360) + 540) % 360 - 180);   // turn the short way round
    if (snap || reduced) { Object.assign(cam, goal); tween = null; }
    else tween = { from: Object.assign({}, cam), t: 0 };
  }
  function place() {
    const d = cam.dist * fit, a = rad(cam.az), e = rad(clamp(cam.el, LIMIT.el[0], LIMIT.el[1]));
    camera.position.set(cam.tx + Math.sin(a) * Math.cos(e) * d, Math.max(1.5, cam.ty + Math.sin(e) * d), cam.tz + Math.cos(a) * Math.cos(e) * d);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    const k = cam.dist * fit * 0.07;
    labels.forEach((l) => l.scale.set(k * l.userData.w, k * 0.3125, 1));
  }

  let step = 1, rafId = 0, last = 0, size = [0, 0], dpr = 1, alive = true, drag = 0;
  function setSize(w, h, ratio) {
    ratio = Math.min(ratio || 1, maxDpr);
    if (!w || !h || (w === size[0] && h === size[1] && ratio === dpr)) return;
    size = [w, h]; dpr = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    aspect = w / h; fit = Math.max(1, 1 / aspect) * (aspect > 1.4 ? 0.88 : 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (POSE[step].fit && !drag && Math.abs(aspect - fitAspect) > 0.01) { fitAspect = aspect; setPose(POSE[step], true); }   // refit on resize / rotate
    wake();
  }
  function frameTick(now) {
    rafId = 0;
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    if (!drag && tween) {
      tween.t = Math.min(1, tween.t + dt / GLIDE);
      const e = ease(tween.t);
      for (const key of ['tx', 'ty', 'tz', 'dist', 'az', 'el']) cam[key] = tween.from[key] + (goal[key] - tween.from[key]) * e;
      if (tween.t >= 1) { Object.assign(cam, goal); tween = null; } else moving = true;
    } else if (drag) moving = true;
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

  function setState(n) {   // also what "Reset view" calls: glide back to the current step's pose
    step = clamp(n | 0, 1, STEPS);
    fitAspect = aspect;
    setPose(POSE[step]);
    targets(step);
    wake();
  }

  /* ---------- orbit: drag to rotate, two fingers to pinch. Input arrives as calls (the page forwards its pointer events) ---------- */
  const ptrs = new Map();
  let pinch = 0;
  function stopGlide() { tween = null; Object.assign(goal, cam); }
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
  Object.assign(cam, goal); tween = null;
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
