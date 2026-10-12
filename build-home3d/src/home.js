/* Home "Inside the building": generic 3-storey commercial building, built in code (no model file).
   Realistic parts, PBR textures (ambientCG, CC0), one HDRI (Poly Haven, CC0), unbranded.
   Render on demand: frames are drawn only while the scene is moving and the section is on screen. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, DirectionalLight,
  TextureLoader, SRGBColorSpace, RepeatWrapping, EquirectangularReflectionMapping, PMREMGenerator, ACESFilmicToneMapping,
  Color, Vector3, Matrix4, Quaternion, CanvasTexture, LinearFilter, LinearMipmapLinearFilter, AdditiveBlending, DoubleSide,
  CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, LatheGeometry, Vector2, PCFShadowMap, PlaneGeometry,
  CircleGeometry, InstancedMesh, BoxGeometry
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Part, V, T, mat, boxGeo, cylBetween, tubeGeo, instanced, dashMatrices } from './util.js';

const COL = { fiber: 0x53c3df, cabling: 0xe0a85a, wireless: 0x7fe3a0, surveillance: 0xc79bff, access: 0xff9a6b };
const FH = 3.6, CEIL = 2.7, TRAY_Y = 3.05, HX = 12, HZ = 6;
const BASE = new URL('home/', import.meta.url).href;

/* ---- story table: camera pose, floor lifts (floor 1, floor 2, roof) per stage ---- */
const POSES = [
  null,
  { pos: [-22, 24, 31], tgt: [-8, 0.5, 7.5], off: [0, 0, 0], glass: 0.82, fov: 34 },
  { pos: [-6, 8.2, 10.5], tgt: [-9.4, 1.2, 0.8], off: [6.5, 11, 15], glass: 0.16, fov: 30 },
  { pos: [-24, 13, 26], tgt: [-8, 7.2, -1], off: [3.4, 6.8, 10.2], glass: 0.16, fov: 34 },
  { pos: [5, 22, 17], tgt: [0, 4.6, 0], off: [0.4, 9.5, 13.5], glass: 0.14, fov: 32 },
  { pos: [7, 23, 17], tgt: [3.5, 4.2, 0], off: [0.4, 9.5, 13.5], glass: 0.14, fov: 33 },
  { pos: [14, 21, 38], tgt: [7, 4.5, 3], off: [3.2, 6.4, 9.6], glass: 0.12, fov: 36 },
  { pos: [4, 22, 12], tgt: [2, 4.5, 0.8], off: [0.4, 9.5, 13.5], glass: 0.1, fov: 30 },
  { pos: [10, 21, 40], tgt: [3, 4.5, 1], off: [2.2, 4.4, 5.6], glass: 0.12, fov: 36 }
];

/* ---- stage labels: world anchors (floor index f, or -1 for ground level) ---- */
const FOCUS_POSE = { fiber: { pos: [-24, 14, 34], tgt: [-8, 4, 3], off: [3.4, 6.8, 10.2], glass: 0.1, fov: 36 }, cabling: 4, wireless: 5, surveillance: 6, access: 7 };
const poseOf = (stage, focus) => { if (!focus) return POSES[stage]; const f = FOCUS_POSE[focus]; return typeof f === 'number' ? Object.assign({}, POSES[f], { glass: 0.08 }) : f; };
const L = (text, f, x, y, z) => ({ text, f, p: [x, y, z] });
const STAGE_LABELS = {
  1: [L('Handhole at the kerb', -1, -10.9, 0.1, 9.3), L('Underground conduit with OSP fiber', -1, -14.5, -0.8, 10.9)],
  2: [L('Fiber enclosure and splice point', 0, -11.7, 1.3, 2.4), L('MDF rack: panels, switches, UPS', 0, -9, 1.4, 0.45)],
  3: [L('Firestopped riser sleeves', 1, -10.5, 0, -2.2), L('IDF, floor 2', 1, -9, 1.2, 0.45), L('IDF, floor 3', 2, -9, 1.2, 0.45)],
  4: [L('Cable tray along the corridor', 1, 3, TRAY_Y, 0), L('J-hooks branch to outlets', 1, 2.5, TRAY_Y, 2.6)],
  5: [L('Ceiling access point', 1, 4, CEIL, 3.2), L('Coverage (illustrative)', 1, 9.5, 1.2, -3.5)],
  6: [L('Entry camera', 0, 0, 2.55, 4.4), L('Corridor camera', 1, 10.6, 2.55, 0), L('Parking camera', -1, 21, 5.4, 8)],
  7: [L('Reader on the door frame, latch side', 1, 3.03, 1.2, 1.65), L('Panel in the IDF', 1, -11.8, 1.4, -1.2)],
  8: []
};
const FOCUS_LABELS = {
  fiber: [L('OSP fiber from the kerb', -1, -14.5, -0.8, 10.9), L('Riser backbone', 1, -10.5, 1.5, -2.2)],
  cabling: [L('MDF rack', 0, -9, 1.4, 0.45), L('IDFs on each floor', 1, -9, 1.2, 0.45), L('Tray and J-hooks', 1, 3, TRAY_Y, 0)],
  wireless: [L('Ceiling access points', 1, 4, CEIL, 3.2), L('Coverage (illustrative)', 1, 9.5, 1.2, -3.5)],
  surveillance: [L('Entry camera', 0, 0, 2.55, 4.4), L('Corridor camera', 1, 10.6, 2.55, 0), L('Parking camera', -1, 21, 5.4, 8)],
  access: [L('Readers on door frames', 1, 3.03, 1.2, 1.65), L('Panel in the IDF', 1, -11.8, 1.4, -1.2)]
};

export function mount(el, options) {
  options = options || {};
  const frame = el.parentElement;
  const section = frame.closest('.hyb-stage');
  const phone = Math.min(window.innerWidth, window.innerHeight) <= 820 || matchMedia('(pointer: coarse)').matches;
  const tier = phone ? 's' : 'm';
  const maxDpr = phone ? 1 : 1.5;

  /* ---------- renderer, scene, camera, light ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 640 / 462, 0.5, 400);
  const sun = new DirectionalLight(0xfff1de, 2.4);
  sun.position.set(26, 46, 34); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; // the only shadow in the scene
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 4; sc.far = 130;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  /* ---------- textures and materials ---------- */
  const loader = new TextureLoader();
  let pending = 0, onAllLoaded = null, loadedErr = 0;
  const texCache = {};
  function done() { pending--; invalidate(); if (pending === 0 && onAllLoaded) onAllLoaded(); }
  function tex(set, kind, tile) {
    const key = set + kind + tile;
    if (texCache[key]) return texCache[key];
    pending++;
    const t = loader.load(BASE + 'tex' + tier + '/' + set + '_' + kind + '.webp', done, undefined, () => { loadedErr++; done(); });
    t.wrapS = t.wrapT = RepeatWrapping;
    if (kind === 'Color') t.colorSpace = SRGBColorSpace;
    t.anisotropy = phone ? 2 : 6;
    texCache[key] = t;
    return t;
  }
  function pbr(set, o) {
    o = o || {};
    const m = new MeshStandardMaterial({
      color: o.color === undefined ? 0xffffff : o.color,
      map: tex(set, 'Color'), normalMap: tex(set, 'NormalGL'), roughnessMap: tex(set, 'Roughness'),
      roughness: o.rough === undefined ? 1 : o.rough, metalness: o.metal || 0
    });
    if (o.metalMap) { m.metalnessMap = tex(set, 'Metalness'); m.metalness = o.metal === undefined ? 1 : o.metal; }
    if (o.vc) { m.vertexColors = true; m.color.set(0xffffff); }
    if (o.normal !== undefined) m.normalScale.set(o.normal, o.normal);
    if (o.emissive !== undefined) { m.emissive = new Color(o.emissive); m.emissiveIntensity = 0; m.userData.glow = o.glowBase || 1; }
    m.userData.sys = o.sys;
    return m;
  }
  function plain(color, rough, metal, o) {
    const m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal || 0 });
    if (o && o.emissive !== undefined) { m.emissive = new Color(o.emissive); m.emissiveIntensity = 0; m.userData.glow = o.glowBase || 1; }
    return m;
  }
  // Four textured bases (vertex-coloured, so tinted parts of one kind merge into one draw call) and two plain PBR bases for hardware.
  const hw = (metal, rough) => new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: metal, roughness: rough });
  const B = {
    concrete: pbr('Concrete034', { vc: true, normal: 0.8 }),
    asphalt: pbr('Asphalt031', { vc: true }),
    metal: pbr('Metal027', { vc: true, metal: 1, metalMap: true, rough: 0.9 }),
    painted: pbr('PaintedMetal004', { vc: true, metal: 0.7, metalMap: true, rough: 1 }),
    hwMetal: hw(0.55, 0.5),
    hwPlastic: hw(0.0, 0.5)
  };
  const M = {
    concrete: T(B.concrete, 0xc9cdd0), paving: T(B.concrete, 0xa6abb0),
    asphalt: T(B.asphalt, 0x8c9096), gravel: T(B.asphalt, 0x9a8c7a), soil: T(B.asphalt, 0x2e2520),
    steel: T(B.metal, 0xd8dde0), galv: T(B.metal, 0xdfe5e8),
    painted: T(B.painted, 0x2b3238),
    copper: T(B.hwMetal, 0xb87333), rackBlack: T(B.hwMetal, 0x3b4249), hwSteel: T(B.hwMetal, 0xc9cfd3),
    plastic: T(B.hwPlastic, 0xe7ecef), plasticDark: T(B.hwPlastic, 0x4a545c), black: T(B.hwPlastic, 0x0e1113), lens: T(B.hwPlastic, 0x06090c),
    drywall: T(B.hwPlastic, 0xe9eaec), paint: T(B.hwPlastic, 0xeef0f2), bond: T(B.hwPlastic, 0x2e9b4a),
    rubber: T(B.hwPlastic, 0x4a4f55), jacketBlue: T(B.hwPlastic, 0x1c4f96), jacketGray: T(B.hwPlastic, 0x777d84),
    glass: new MeshStandardMaterial({ color: 0x9cc9dc, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8, depthWrite: false }),
    ceiling: null, // set below (canvas texture)
    innerduct: plain(0xe8730c, 0.55, 0, null),
    ghost: new MeshStandardMaterial({ color: 0x23323b, roughness: 1, transparent: true, opacity: 0.10, depthWrite: false })
  };
  // Per-system emissive materials (glow ramps with the story)
  const G = {};
  Object.keys(COL).forEach((k) => {
    G[k] = {
      solid: plain(0x10161a, 0.5, 0.2, { emissive: COL[k], glowBase: 3.2 }),
      cable: plain(0x1a2c44, 0.55, 0, { emissive: COL[k], glowBase: 1.5 }),
      led: plain(0x0a0d0f, 0.6, 0, { emissive: COL[k], glowBase: 3 }),
      field: new MeshBasicMaterial({ color: COL[k], transparent: true, opacity: 0.0, depthWrite: false, side: DoubleSide })
    };
  });
  const FIELD_OPACITY = { wireless: 0.2, surveillance: 0.2 };
  M.innerduct.transparent = true; M.innerduct.opacity = 0.32; M.innerduct.depthWrite = false;

  // Ceiling tile grid: one canvas texture (T-bar lines + faint tiles), not hundreds of meshes.
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(214,222,228,0.16)'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(235,240,244,0.85)'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64);
    const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter; t.anisotropy = 4;
    M.ceiling = new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, side: DoubleSide });
  })();

  /* ---------- environment (the one HDRI) ---------- */
  const pmrem = new PMREMGenerator(renderer);
  pending++;
  new HDRLoader().load(BASE + 'env/studio_small_09_' + (phone ? '256x128' : '512x256') + '.hdr', (t) => {
    t.mapping = EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(t).texture;
    scene.environmentIntensity = 0.85;
    t.dispose(); pmrem.dispose();
    done();
  }, undefined, () => { loadedErr++; done(); });

  /* ---------- registry of story items ---------- */
  const items = []; // { obj, sys, from }
  function reg(obj, sys, from) { items.push({ obj, sys, from }); return obj; }
  const world = new Group(); scene.add(world);
  const floors = [new Group(), new Group(), new Group()];
  const roof = new Group();
  world.add(floors[0], floors[1], floors[2], roof);
  floors.forEach((g, i) => { g.position.y = i * FH; });
  roof.position.y = 3 * FH;

  /* ---------- geometry kit (shared, instanced where parts repeat) ---------- */
  const G_ = {
    jhook: (function () {
      const pts = [V(0, 0.42, 0), V(0, 0.08, 0), V(0.02, -0.03, 0), V(0.1, -0.075, 0), V(0.19, -0.04, 0), V(0.22, 0.06, 0)];
      const g = tubeGeo(pts, 0.012, 9, 4, 0.5); g.translate(-0.11, 0, 0); return g;
    })(),
    wrap: new CylinderGeometry(0.056, 0.056, 0.05, 10, 1, true),
    ap: (function () {
      const pr = [new Vector2(0.001, -0.032), new Vector2(0.11, -0.03), new Vector2(0.125, -0.02), new Vector2(0.128, -0.005), new Vector2(0.12, 0.0), new Vector2(0.001, 0.0)];
      return new LatheGeometry(pr, 28);
    })(),
    apRing: new TorusGeometry(0.075, 0.006, 6, 24),
    dome: (function () {
      const g = new SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); return g;
    })(),
    domeBase: new CylinderGeometry(0.13, 0.13, 0.045, 20),
    led: new PlaneGeometry(0.012, 0.008),
    port: new PlaneGeometry(0.0125, 0.0105),
    reader: new RoundedBoxGeometry(0.09, 0.2, 0.03, 3, 0.012),
    readerLed: new BoxGeometry(0.05, 0.012, 0.004),
    stripe: new BoxGeometry(0.16, 0.01, 4.6),
    dashCyl: new CylinderGeometry(1, 1, 1, 4, 1, true),
    bead: new SphereGeometry(0.11, 8, 6),
    cone: (function () { const g = new ConeGeometry(2.1, 6.2, 20, 1, true); g.translate(0, -3.1, 0); return g; })(),
    hemi: new SphereGeometry(4.3, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    ring: new CircleGeometry(4.3, 32)
  };

  /* ---------- ground, street, trench ---------- */
  const ground = new Group(); world.add(ground);
  // Rectangles carved around holes so the open trench shows soil layers and the conduit.
  function carve(x0, x1, z0, z1, holes) {
    const xs = [x0, x1], zs = [z0, z1];
    holes.forEach((h) => { xs.push(h[0], h[1]); zs.push(h[2], h[3]); });
    const ux = Array.from(new Set(xs)).filter((v) => v >= x0 && v <= x1).sort((a, b) => a - b);
    const uz = Array.from(new Set(zs)).filter((v) => v >= z0 && v <= z1).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < ux.length - 1; i++) for (let j = 0; j < uz.length - 1; j++) {
      const cx = (ux[i] + ux[i + 1]) / 2, cz = (uz[j] + uz[j + 1]) / 2;
      if (holes.some((h) => cx > h[0] && cx < h[1] && cz > h[2] && cz < h[3])) continue;
      out.push([ux[i], ux[i + 1], uz[j], uz[j + 1]]);
    }
    return out;
  }
  const TR_X = [-11.5, -10.3];         // lateral trench to the building
  const TR_Z = [10.3, 11.3];           // main duct along the street
  const holes = [[TR_X[0], TR_X[1], 6.2, 11.3], [-18, TR_X[1], TR_Z[0], TR_Z[1]]];
  const gp = new Part();
  const slabT = 0.3;
  function layer(mt, x0, x1, z0, z1, y0, y1, hs, tile) {
    carve(x0, x1, z0, z1, hs).forEach((r) => gp.box(mt, r[1] - r[0], y1 - y0, r[3] - r[2], (r[0] + r[1]) / 2, (y0 + y1) / 2, (r[2] + r[3]) / 2, tile));
  }
  layer(M.soil, -18, 30, -12, 20, -1.6, -slabT, holes);                 // soil
  gp.box(M.gravel, 12.5 - 0, 0.12, 1.0, -14.2, -1.54, 10.8, 3);          // trench bedding, main duct
  gp.box(M.gravel, TR_X[1] - TR_X[0], 0.12, 5.3, -10.9, -1.54, 8.6, 3);  // trench bedding, lateral
  gp.box(M.gravel, 7.7, 0.12, 1.0, -14.15, -1.54, 10.8, 3);
  layer(M.paving, -18, 30, 6.0, 9.0, -slabT, 0, holes, 2.5);            // sidewalk
  layer(M.asphalt, -18, 30, 9.0, 20, -slabT, 0, holes, 3);              // street
  layer(M.asphalt, 12.5, 30, -12, 9.0, -slabT, 0, holes, 3);            // parking
  layer(M.paving, -18, 12.5, -12, 6.0, -slabT, 0, holes, 2.5);          // yard around the building
  gp.box(M.paving, 48, 0.22, 0.25, 6, 0.11, 9.0, 2.5);                  // kerb
  const gm = gp.build({ receive: true }); ground.add(gm);
  // Street markings and parking bays (instanced stripes)
  const stripeM = [];
  for (let i = 0; i < 7; i++) stripeM.push(mat(14.4 + i * 2.6, 0.012, 3.2, 0, 0, 0));
  ground.add(instanced(G_.stripe, M.paint, stripeM));
  const dashM = [];
  for (let i = 0; i < 16; i++) dashM.push(mat(-16 + i * 3, 0.012, 14.6, 0, Math.PI / 2, 0, 1, 1, 0.42));
  ground.add(instanced(G_.stripe, M.paint, dashM));

  // OSP: orange innerduct with a lit fiber inside, handhole at the kerb
  const ospP = new Part(), ospFiber = new Part();
  const path = [V(-18, -0.8, 10.8), V(-10.9, -0.8, 10.8), V(-10.9, -0.8, 6.4)];
  ospP.between(M.innerduct, path[0], path[1], 0.1, 16);
  ospP.between(M.innerduct, path[1], path[2], 0.1, 16);
  ospFiber.between(G.fiber.cable, path[0], path[1], 0.06, 8);
  ospFiber.between(G.fiber.cable, path[1], path[2], 0.06, 8);
  // Entrance: conduit rises through the wall sleeve at floor level and runs on the wall to the enclosure
  const inP = [V(-10.9, -0.8, 6.4), V(-10.9, 0.0, 5.7), V(-10.9, 0.25, 5.2), V(-10.9, 0.25, 2.6), V(-11.55, 0.25, 2.6), V(-11.7, 0.5, 2.45), V(-11.7, 1.05, 2.45)];
  ospP.tube(M.steel, inP.slice(2), 0.045, 40, 10, 0.1);
  ospP.tube(M.innerduct, inP.slice(0, 3), 0.1, 14, 14, 0.5);
  ospFiber.tube(G.fiber.cable, inP.slice(0, 3), 0.045, 14, 8, 0.5);
  const ospGroup = new Group();
  ospGroup.add(ospP.build({ receive: true }), ospFiber.build({ receive: false }));
  // handhole: concrete box in the sidewalk with lid and a ring, cable slack inside
  const hh = new Part();
  hh.box(M.concrete, 0.95, 0.1, 0.7, -10.9, 0.04, 9.3, 1.2, 0);
  hh.box(M.galv, 0.82, 0.03, 0.58, -10.9, 0.105, 9.3, 0.8);
  hh.cyl(M.steel, 0.045, 0.03, -10.9 + 0.2, 0.125, 9.3, 0, 0, 0, 14);
  hh.cyl(M.steel, 0.045, 0.03, -10.9 - 0.2, 0.125, 9.3, 0, 0, 0, 14);
  ospGroup.add(hh.build({ receive: true }));
  world.add(reg(ospGroup, 'fiber', 1));
  // light beads travelling along the OSP path (count follows story progress)
  const BEADS = 36;
  const beadsMat = G.fiber.cable;
  const beads = new InstancedMesh(G_.bead, beadsMat, BEADS);
  beads.frustumCulled = false; beads.userData.baseMat = beadsMat;
  const beadPts = [];
  (function () {
    const pts = [V(-18, -0.8, 10.8), V(-10.9, -0.8, 10.8), V(-10.9, -0.8, 6.4), V(-10.9, 0.0, 5.7), V(-10.9, 0.25, 5.2), V(-10.9, 0.25, 2.6), V(-11.7, 0.5, 2.45), V(-11.7, 1.05, 2.45)];
    let total = 0; const seg = [];
    for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); seg.push(l); total += l; }
    for (let b = 0; b < BEADS; b++) {
      let d = (b / (BEADS - 1)) * total, i = 0;
      while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
      beadPts.push(pts[i].clone().lerp(pts[i + 1], Math.min(1, d / seg[i])));
    }
    const m = new Matrix4();
    beadPts.forEach((p, b) => { m.makeTranslation(p.x, p.y, p.z); beads.setMatrixAt(b, m); });
    beads.instanceMatrix.needsUpdate = true; beads.count = 0;
  })();
  world.add(reg(beads, 'fiber', 1));

  // Parking camera pole (surveillance, looks back at the building)
  const pole = new Group(); world.add(reg(pole, 'surveillance', 6));
  (function () {
    const p = new Part();
    p.cyl(M.galv, 0.09, 5.2, 21.5, 2.6, 8.2, 0, 0, 0, 12);
    p.box(M.concrete, 0.5, 0.35, 0.5, 21.5, 0.17, 8.2, 1);
    p.between(M.galv, V(21.5, 5.0, 8.2), V(21.0, 5.25, 8.2), 0.05, 8);
    pole.add(p.build({ cast: true }));
    const cam = makeBullet();
    cam.position.set(21.0, 5.25, 8.2); aim(cam, V(-1, -0.28, -0.55));
    pole.add(cam);
    const cone = new Mesh(G_.cone, G.surveillance.field); cone.position.copy(cam.position); aim(cone, V(-1, -0.28, -0.55), true);
    cone.userData.field = 'surveillance'; cone.renderOrder = 6; pole.add(cone);
  })();

  function aim(obj, dir, coneStyle) {
    const q = new Quaternion().setFromUnitVectors(coneStyle ? new Vector3(0, -1, 0) : new Vector3(0, 0, 1), dir.clone().normalize());
    obj.quaternion.copy(q);
  }
  function makeBullet() {
    const g = new Group(), p = new Part();
    p.cyl(M.plastic, 0.045, 0.24, 0, 0, 0.1, Math.PI / 2, 0, 0, 16);
    p.box(M.plastic, 0.11, 0.012, 0.28, 0, 0.06, 0.1);               // sun shield
    p.cyl(M.lens, 0.032, 0.012, 0, 0, 0.225, Math.PI / 2, 0, 0, 14);
    p.cyl(M.plasticDark, 0.05, 0.05, 0, 0, -0.03, Math.PI / 2, 0, 0, 14);
    p.add(M.galv, new SphereGeometry(0.04, 10, 8), mat(0, 0, -0.07));
    g.add(p.build());
    g.scale.setScalar(1.7);
    return g;
  }

  /* ---------- roof ---------- */
  (function () {
    const p = new Part();
    p.box(M.concrete, 2 * HX + 0.8, 0.3, 2 * HZ + 0.8, 0, -0.15, 0, 2.5);
    p.box(M.concrete, 2 * HX + 0.8, 0.5, 0.2, 0, 0.25, HZ + 0.3, 2.5);
    p.box(M.concrete, 2 * HX + 0.8, 0.5, 0.2, 0, 0.25, -HZ - 0.3, 2.5);
    p.box(M.concrete, 0.2, 0.5, 2 * HZ + 0.6, HX + 0.3, 0.25, 0, 2.5);
    p.box(M.concrete, 0.2, 0.5, 2 * HZ + 0.6, -HX - 0.3, 0.25, 0, 2.5);
    p.cyl(M.steel, 0.2, 0.9, 6, 0.45, -3, 0, 0, 0, 16); p.cyl(M.steel, 0.28, 0.1, 6, 0.95, -3, 0, 0, 0, 16);
    p.cyl(M.steel, 0.2, 0.9, 8, 0.45, -3, 0, 0, 0, 16); p.cyl(M.steel, 0.28, 0.1, 8, 0.95, -3, 0, 0, 0, 16);
    p.box(M.galv, 1.6, 0.9, 1.1, -3, 0.45, 2, 1, 0);
    p.cyl(M.rubber, 0.36, 0.06, -3, 0.93, 2, 0, 0, 0, 20);
    roof.add(p.build({ cast: true, castOnly: B.concrete }));
  })();

  /* ---------- floors ---------- */
  const doorXs = [-3, 2.5, 7.5];
  const readerM = [], riserSleeve = [];
  const apPos = [[-2, 3.2], [4, 3.2], [9.5, 3.2], [-2, -3.5], [4, -3.5], [9.5, -3.5]];
  const sleeveXZ = [-10.5, -2.2];

  function addDoor(p, x, z, ry, floorIdx, collect) {
    // local frame: door in a wall running along local X, front face +Z; latch side at +X
    const M4 = mat(x, 0, z, 0, ry, 0);
    p.within(M4, () => {
      p.box(M.painted, 1.12, 0.08, 0.14, 0, 2.12, 0);
      p.box(M.painted, 0.07, 2.12, 0.14, -0.525, 1.06, 0);
      p.box(M.painted, 0.07, 2.12, 0.14, 0.525, 1.06, 0);
      p.box(M.drywall, 0.96, 2.04, 0.04, 0, 1.03, -0.02);
      p.cyl(M.steel, 0.012, 0.1, 0.4, 1.0, 0.04, 0, 0, Math.PI / 2, 8);
      p.box(M.steel, 0.03, 0.12, 0.03, 0.54, 1.0, 0.0);
      p.box(M.steel, 0.03, 0.24, 0.025, -0.5, 0.5, 0.0);
      p.box(M.steel, 0.03, 0.24, 0.025, -0.5, 1.6, 0.0);
    });
    // reader on the latch-side jamb, facing out (+Z in the door frame)
    const rm = new Matrix4().compose(V(0.525, 1.2, 0.09), new Quaternion(), V(1, 1, 1));
    collect.push(M4.clone().multiply(rm));
  }

  function lowWall(p, x0, x1, z0, z1) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    if (w < 0.05 || d < 0.05) return;
    p.box(M.drywall, w, 1.1, d, (x0 + x1) / 2, 0.55, (z0 + z1) / 2, 1.5);
  }

  function rack(p, leds, cords, x, z, units, withUPS, tag) {
    // 4-post open frame rack, 0.6 x 0.9 x 2.1, facing +Z
    const H = 2.1, hw = 0.255, hd = 0.4;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((s) => p.box(M.rackBlack, 0.045, H, 0.045, x + s[0] * hw, H / 2, z + s[1] * hd, 0));
    p.box(M.rackBlack, 0.6, 0.04, 0.9, x, H, z); p.box(M.rackBlack, 0.6, 0.06, 0.9, x, 0.03, z);
    [[-1], [1]].forEach((s) => { p.box(M.rackBlack, 0.02, 0.02, 0.8, x + s[0] * hw, H - 0.04, z); p.box(M.rackBlack, 0.02, 0.02, 0.8, x + s[0] * hw, 0.1, z); });
    p.box(M.rackBlack, 0.64, 0.02, 0.9, x, 0.07, z);
    const U = 0.0445, front = z + hd - 0.02;
    let y = H - 0.12; const cursor = () => (y -= U, y + U / 2);
    function faceplate(h, mt) { const yy = (y -= h * U, y + (h * U) / 2); p.box(mt, 0.482, h * U - 0.002, 0.02, x, yy, front); return yy; }
    function portRow(yy, n, startX, pitch) {
      for (let i = 0; i < n; i++) p.add(M.black, G_.port.clone(), mat(x + startX + i * pitch, yy, front + 0.0105));
    }
    function sled(yy, depth) { p.box(M.painted, 0.44, 0.04, depth, x, yy, front - depth / 2 - 0.005); }
    const plan = units === 'mdf'
      ? ['fiber', 'pp', 'mgr', 'sw', 'pp', 'mgr', 'sw', 'pp', 'mgr']
      : ['pp', 'mgr', 'sw', 'pp'];
    plan.forEach((k) => {
      if (k === 'pp') { const yy = faceplate(1, M.plasticDark); portRow(yy + 0.007, 12, -0.205, 0.0165); portRow(yy - 0.007, 12, -0.205, 0.0165); }
      else if (k === 'sw') { const yy = faceplate(1, M.rackBlack); portRow(yy + 0.007, 12, -0.18, 0.0165); portRow(yy - 0.007, 12, -0.18, 0.0165); for (let i = 0; i < 6; i++) leds.push(mat(x + 0.14 + i * 0.016, yy + 0.004, front + 0.011)); sled(yy, 0.38); }
      else if (k === 'mgr') { const yy = faceplate(1, M.rackBlack); for (let i = 0; i < 8; i++) p.box(M.black, 0.03, 0.03, 0.02, x - 0.19 + i * 0.054, yy, front + 0.012); }
      else if (k === 'fiber') { const yy = faceplate(2, M.plasticDark); for (let i = 0; i < 12; i++) p.box(M.lens, 0.012, 0.02, 0.012, x - 0.18 + i * 0.03, yy + 0.015, front + 0.012); for (let i = 0; i < 12; i++) p.box(M.lens, 0.012, 0.02, 0.012, x - 0.18 + i * 0.03, yy - 0.015, front + 0.012); sled(yy, 0.3); }
    });
    if (withUPS) {
      p.box(M.plasticDark, 0.47, 0.17, 0.62, x, 0.2, z - 0.05);
      p.box(M.rackBlack, 0.48, 0.17, 0.02, x, 0.2, front);
      p.box(M.plasticDark, 0.2, 0.03, 0.012, x - 0.1, 0.22, front + 0.012);
      for (let i = 0; i < 5; i++) leds.push(mat(x + 0.12 + i * 0.016, 0.2, front + 0.012));
      p.box(M.rackBlack, 0.47, 0.3, 0.02, x, 0.43, front); p.box(M.plasticDark, 0.44, 0.26, 0.5, x, 0.43, z - 0.1);
    }
    // vertical cable manager + patch cords + hook-and-loop wraps on the side
    p.box(M.rackBlack, 0.1, H - 0.2, 0.18, x + 0.38, H / 2, z + 0.28);
    for (let i = 0; i < 7; i++) p.box(M.plasticDark, 0.1, 0.012, 0.2, x + 0.38, 0.35 + i * 0.22, z + 0.28);
    // patch cords from panel to switch (curved, short)
    for (let i = 0; i < 5; i++) {
      const y0 = H - 0.12 - (tag === 'mdf' ? 0.18 : 0.12) - i * 0.0, xs = x - 0.17 + i * 0.07;
      cords.push([V(xs, y0 - 0.09, front + 0.02), V(xs + 0.03, y0 - 0.09, front + 0.09), V(xs + 0.2, y0 - 0.2, front + 0.1), V(xs + 0.28, y0 - 0.28, front + 0.04)]);
    }
  }

  const rackWraps = [];
    for (let f = 0; f < 3; f++) {
    const g = floors[f];
    const shell = new Part();
    shell.box(M.concrete, 2 * HX + 0.6, slabT, 2 * HZ + 0.6, 0, -slabT / 2, 0, 2.5);
    // walls: left and back are solid, front and right are glass curtain wall
    shell.box(M.concrete, 0.3, 3.3, 2 * HZ, -HX, 1.65, 0, 2.5);
    shell.box(M.concrete, 2 * HX, 3.3, 0.3, 0, 1.65, -HZ, 2.5);
    shell.box(M.concrete, 2 * HX + 0.6, 0.2, 0.3, 0, 3.5, -HZ - 0.05, 2.5);
    const glassM = new Part();
    for (let i = 0; i < 8; i++) {
      const cx = -HX + 1.5 + i * 3;
      if (f === 0 && Math.abs(cx) < 1.6) continue; // lobby door bay
      glassM.box(M.glass, 2.88, 3.2, 0.03, cx, 1.7, HZ);
    }
    for (let i = 0; i <= 8; i++) shell.box(M.painted, 0.07, 3.3, 0.1, -HX + i * 3, 1.65, HZ + 0.02);
    shell.box(M.painted, 2 * HX, 0.06, 0.1, 0, 0.05, HZ + 0.02);
    glassM.box(M.glass, 0.03, 3.2, 2 * HZ - 0.4, HX, 1.7, 0);
    for (let i = 0; i <= 4; i++) shell.box(M.painted, 0.1, 3.3, 0.07, HX, 1.65, -HZ + 0.2 + i * 2.9);
    if (f === 0) { // lobby double door
      shell.box(M.painted, 3.4, 0.1, 0.12, 0, 2.25, HZ + 0.02); shell.box(M.painted, 0.09, 2.25, 0.12, -1.65, 1.12, HZ + 0.02); shell.box(M.painted, 0.09, 2.25, 0.12, 1.65, 1.12, HZ + 0.02);
      glassM.box(M.glass, 1.55, 2.1, 0.03, -0.8, 1.1, HZ); glassM.box(M.glass, 1.55, 2.1, 0.03, 0.8, 1.1, HZ);
      glassM.box(M.glass, 3.2, 0.9, 0.03, 0, 2.8, HZ);
    }
    // low cutaway partitions (1.1 m) with door gaps
    lowWall(shell, -6, doorXs[0] - 0.55, 1.5, 1.5 + 0.12); lowWall(shell, -6, doorXs[0] - 0.55, -1.5, -1.5 - 0.12);
    for (let i = 0; i < 3; i++) {
      const a = doorXs[i] + 0.55, b = i < 2 ? doorXs[i + 1] - 0.55 : HX - 0.15;
      lowWall(shell, a, b, 1.5, 1.62); lowWall(shell, a, b, -1.5, -1.62);
    }
    lowWall(shell, -6.06, -5.94, -HZ + 0.15, -0.55); lowWall(shell, -6.06, -5.94, 0.55, HZ);
    lowWall(shell, 5.0, 5.12, 1.5, HZ); lowWall(shell, 5.0, 5.12, -HZ + 0.15, -1.5);
    // doors + readers
    const rd = [];
    doorXs.forEach((dx) => { addDoor(shell, dx, 1.56, 0, f, rd); addDoor(shell, dx, -1.56, Math.PI, f, rd); });
    addDoor(shell, -6, 0, -Math.PI / 2, f, rd);
    if (f === 0) { const m = new Matrix4().compose(V(1.72, 1.2, HZ + 0.1), new Quaternion(), V(1, 1, 1)); rd.push(m); }
    const shellG = shell.build({ cast: true, castOnly: B.concrete });
    shellG.userData.shell = true;
    g.add(shellG);
    const glass = glassM.build({ receive: false });
    glass.children.forEach((m) => { m.renderOrder = 4; m.userData.glass = true; });
    g.add(glass);
    // ceiling grid plane (not over the MDF)
    const cg = new PlaneGeometry(HX - 6 - 0.2, 2 * HZ - 0.4);
    cg.rotateX(Math.PI / 2);
    const cm = new Mesh(cg, M.ceiling.clone()); cm.material.map = M.ceiling.map.clone(); cm.material.map.needsUpdate = true;
    cm.material.map.repeat.set((HX - 6.2) / 0.6, (2 * HZ - 0.4) / 0.6); cm.material.map.wrapS = cm.material.map.wrapT = RepeatWrapping;
    cm.position.set((HX + 6) / 2, CEIL, 0); cm.renderOrder = 3; cm.userData.ceiling = true;
    g.add(cm);

    /* --- cabling: rack + runway (MDF stage 2, IDF stage 3), then tray, J-hooks, outlets (stage 4) --- */
    const isMDF = f === 0;
    const cab = new Part(), leds = [], cords = [];
    rack(cab, leds, cords, -9, 0, isMDF ? 'mdf' : 'idf', isMDF, isMDF ? 'mdf' : 'idf');
    cords.forEach((c) => cab.tube(G.cabling.cable, c, 0.0055, 14, 5));
    const tray = new Part();
    function ladder(part, a, b) {
      part.between(M.galv, V(a.x, a.y, a.z - 0.2), V(b.x, b.y, b.z - 0.2), 0.016, 8);
      part.between(M.galv, V(a.x, a.y, a.z + 0.2), V(b.x, b.y, b.z + 0.2), 0.016, 8);
    }
    // ladder runway over the rack, bends up to the corridor tray
    ladder(cab, V(-9.35, 2.35, 0), V(-8.2, 2.35, 0)); ladder(cab, V(-8.2, 2.35, 0), V(-6.4, TRAY_Y, 0));
    const rung = () => new BoxGeometry(0.03, 0.025, 0.4);
    for (let i = 0; i < 8; i++) cab.add(M.galv, rung(), mat(-9.25 + i * 0.16, 2.35, 0));
    const slopeAng = Math.atan2(TRAY_Y - 2.35, 1.8);
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; cab.add(M.galv, rung(), mat(-8.2 + 1.8 * t, 2.35 + (TRAY_Y - 2.35) * t, 0, 0, 0, slopeAng)); }
    const cabY = TRAY_Y + 0.03;
    [-0.12, -0.04, 0.04, 0.12].forEach((zo, i) => {
      cab.between(i % 2 ? G.cabling.cable : M.jacketBlue, V(-8.9, 2.38, zo * 0.6), V(-8.2, 2.38, zo * 0.6), 0.013, 8);
      cab.between(i % 2 ? G.cabling.cable : M.jacketBlue, V(-8.2, 2.38, zo), V(-6.4, cabY, zo), 0.013, 8);
    });
    // busbar and bonding conductor (MDF only)
    if (isMDF) {
      cab.box(M.copper, 0.05, 0.1, 0.6, -HX + 0.2, 0.55, -0.9);
      cab.box(M.plasticDark, 0.03, 0.12, 0.03, -HX + 0.2, 0.55, -1.15); cab.box(M.plasticDark, 0.03, 0.12, 0.03, -HX + 0.2, 0.55, -0.65);
      cab.tube(M.bond, [V(-HX + 0.25, 0.55, -0.7), V(-11.2, 0.33, -0.5), V(-10.2, 0.25, -0.2), V(-9.4, 0.22, 0.25), V(-9.27, 0.28, 0.4)], 0.009, 24, 6, 0.5);
    }
    const rackGroup = new Group();
    rackGroup.add(cab.build());
    rackGroup.add(instanced(G_.led, G.cabling.led, leds));
    for (let i = 0; i < 5; i++) cab.add(M.rubber, G_.wrap.clone(), mat(-8.62, 0.4 + i * 0.35, 0.28, 0, 0, 0, 0.7, 1, 0.7));
    g.add(reg(rackGroup, 'cabling', isMDF ? 2 : 3));

    // corridor tray: two rails, instanced rungs, cables on top, hanger rods
    ladder(tray, V(-6.4, TRAY_Y, 0), V(HX - 1.2, TRAY_Y, 0));
    for (let x = -6.2; x < HX - 1.2; x += 0.3) tray.add(M.galv, rung(), mat(x, TRAY_Y, 0));
    for (let x = -5; x < HX - 1; x += 2.4) { tray.cyl(M.galv, 0.007, 0.45, x, TRAY_Y + 0.22, -0.2, 0, 0, 0, 6); tray.cyl(M.galv, 0.007, 0.45, x, TRAY_Y + 0.22, 0.2, 0, 0, 0, 6); }
    [-0.12, -0.04, 0.04, 0.12].forEach((zo, i) => tray.between(i % 2 ? G.cabling.cable : M.jacketBlue, V(-6.4, cabY, zo), V(HX - 1.2, cabY, zo), 0.013, 8));
    const addWrap = (m) => tray.add(M.rubber, G_.wrap.clone(), m);
    for (let x = -6.0; x < HX - 1.4; x += 1.1) addWrap(mat(x, cabY, 0, 0, 0, Math.PI / 2, 1, 1, 1));
    // branches: J-hooks every metre along each run, down a service pole to an outlet plate in each room
    const jh = [];
    doorXs.forEach((bx) => {
      [1, -1].forEach((sg) => {
        const z0 = sg * 0.3, z1 = sg * 4.3, bxx = bx + 0.9;
        [-0.016, 0, 0.016].forEach((xo, i) => tray.between(i === 1 ? M.jacketGray : (i === 0 ? M.jacketBlue : G.cabling.cable), V(bxx + xo, TRAY_Y - 0.05, z0), V(bxx + xo, TRAY_Y - 0.05, z1), 0.012, 8));
        tray.between(M.jacketBlue, V(bxx, cabY - 0.02, 0), V(bxx, TRAY_Y - 0.05, z0), 0.012, 8);
        for (let z = z0 + sg * 0.5; Math.abs(z) <= Math.abs(z1) + 0.01; z += sg * 1.0) {
          jh.push(mat(bxx, TRAY_Y - 0.04, z));
          tray.cyl(M.galv, 0.005, 0.3, bxx - 0.11, TRAY_Y + 0.2, z, 0, 0, 0, 6);
        }
        addWrap(mat(bxx, TRAY_Y - 0.05, sg * 1.7, Math.PI / 2, 0, 0, 0.8, 1, 0.8)); addWrap(mat(bxx, TRAY_Y - 0.05, sg * 3.4, Math.PI / 2, 0, 0, 0.8, 1, 0.8));
        tray.between(M.jacketBlue, V(bxx, TRAY_Y - 0.05, z1), V(bxx, 0.95, z1), 0.011, 6);
        tray.cyl(M.galv, 0.04, CEIL + 0.3, bxx - 0.05, (CEIL + 0.3) / 2, z1, 0, 0, 0, 12);
        tray.box(M.plastic, 0.09, 0.12, 0.03, bxx - 0.05, 1.0, z1 + sg * 0.045);
        tray.box(M.plasticDark, 0.05, 0.03, 0.01, bxx - 0.05, 1.03, z1 + sg * 0.062); tray.box(M.plasticDark, 0.05, 0.03, 0.01, bxx - 0.05, 0.97, z1 + sg * 0.062);
        tray.box(M.painted, 0.2, 0.012, 0.2, bxx - 0.05, 0.006, z1);
      });
    });
    const trayGroup = new Group();
    trayGroup.add(tray.build());
    trayGroup.add(instanced(G_.jhook, M.galv, jh));
    g.add(reg(trayGroup, 'cabling', 4));

    // riser: backbone stubs (fiber + copper) from the rack to the sleeve, and the firestopped sleeve through this slab
    const fStub = new Part(), cStub = new Part();
    fStub.tube(G.fiber.cable, [V(-9.1, 2.28, 0.0), V(-9.6, 2.42, -0.8), V(sleeveXZ[0], 2.4, sleeveXZ[1] + 0.9), V(sleeveXZ[0] - 0.03, 2.3, sleeveXZ[1])], 0.021, 20, 8, 0.5);
    cStub.tube(G.cabling.cable, [V(-9.2, 2.3, -0.1), V(-9.7, 2.5, -0.85), V(sleeveXZ[0] + 0.06, 2.46, sleeveXZ[1] + 0.9), V(sleeveXZ[0] + 0.05, 2.3, sleeveXZ[1])], 0.03, 20, 8, 0.5);
    g.add(reg(fStub.build(), 'fiber', 3));
    if (f > 0) {
      cStub.cyl(M.galv, 0.14, 0.5, sleeveXZ[0], 0.05, sleeveXZ[1], 0, 0, 0, 20);
      cStub.add(M.innerduct, new CylinderGeometry(0.155, 0.155, 0.1, 20), mat(sleeveXZ[0], 0.22, sleeveXZ[1]));
      cStub.add(M.innerduct, new CylinderGeometry(0.155, 0.155, 0.1, 20), mat(sleeveXZ[0], -0.3, sleeveXZ[1]));
    }
    g.add(reg(cStub.build(), 'cabling', 3));

    /* --- fiber enclosure at the MDF --- */
    if (isMDF) {
      const fe = new Part();
      fe.box(M.painted, 0.2, 0.55, 0.45, -HX + 0.25, 1.3, 2.45);
      fe.box(M.painted, 0.02, 0.5, 0.42, -HX + 0.37, 1.3, 2.2);   // open door
      for (let i = 0; i < 5; i++) fe.box(M.plasticDark, 0.1, 0.02, 0.3, -HX + 0.28, 1.12 + i * 0.07, 2.47);
      fe.add(G.fiber.cable, new TorusGeometry(0.08, 0.012, 8, 20), mat(-HX + 0.32, 1.45, 2.47, 0, Math.PI / 2, 0));
      fe.add(G.fiber.cable, new TorusGeometry(0.06, 0.012, 8, 20), mat(-HX + 0.33, 1.2, 2.47, 0, Math.PI / 2, 0));
      fe.tube(G.fiber.cable, [V(-HX + 0.3, 1.55, 2.5), V(-11.2, 1.9, 1.8), V(-10.0, 2.2, 0.9), V(-9.05, 2.02, 0.42)], 0.01, 24, 6, 0.5);
      g.add(reg(fe.build(), 'fiber', 2));
    }

    /* --- wireless: ceiling APs (flush in the tile grid, not on the tray) --- */
    const apM = apPos.map((a) => mat(a[0], CEIL - 0.0, a[1]));
    const apGroup = new Group();
    apGroup.add(instanced(G_.ap, M.plastic, apM));
    apGroup.add(instanced(G_.apRing, G.wireless.led, apPos.map((a) => mat(a[0], CEIL - 0.034, a[1], Math.PI / 2, 0, 0))));
    g.add(reg(apGroup, 'wireless', 5));
    if (f === 1) {
      const cov = instanced(G_.hemi, G.wireless.field, apPos.map((a) => mat(a[0], CEIL - 1.6, a[1], 0, 0, 0, 1, 0.36, 1)), { receive: false });
      cov.userData.field = 'wireless'; cov.renderOrder = 6;
      const rings = instanced(G_.ring, G.wireless.field, apPos.map((a) => mat(a[0], 0.03, a[1], -Math.PI / 2, 0, 0)), { receive: false });
      rings.userData.field = 'wireless'; rings.renderOrder = 6;
      const covG = new Group(); covG.add(cov, rings);
      g.add(reg(covG, 'wireless', 5));
    }

    /* --- surveillance: domes merged per floor, view cones instanced --- */
    const cams = new Group(), domeP = new Part(), coneM = [];
    function dome(x, y, z, dir) {
      domeP.add(M.plastic, G_.domeBase.clone(), mat(x, y, z, 0, 0, 0, 1.5, 1.5, 1.5));
      domeP.add(M.lens, G_.dome.clone(), mat(x, y - 0.03, z, 0, 0, 0, 1.5, 1.5, 1.5));
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir.clone().normalize());
      coneM.push(new Matrix4().compose(V(x, y - 0.1, z), q, V(1, 1, 1)));
    }
    dome(10.9, CEIL - 0.08, 0, V(-1, -0.18, 0));
    if (f === 0) { dome(0, CEIL - 0.08, 4.4, V(0.0, -0.55, 1)); dome(-3.2, CEIL - 0.08, -0.1, V(1, -0.2, 0)); }
    cams.add(domeP.build());
    const cones = instanced(G_.cone, G.surveillance.field, coneM, { receive: false });
    cones.userData.field = 'surveillance'; cones.renderOrder = 6; cams.add(cones);
    g.add(reg(cams, 'surveillance', 6));

    /* --- access control: readers on the latch-side jamb, door glow, panel, dashed cable runs --- */
    const acc = new Group();
    acc.add(instanced(G_.reader, M.plasticDark, rd.map((m) => m.clone().multiply(mat(0, 0, 0, 0, 0, 0, 2.2, 2.2, 2.2)))));
    acc.add(instanced(G_.readerLed, G.access.led, rd.map((m) => m.clone().multiply(mat(0, 0.1, 0.035, 0, 0, 0, 2.2, 2.2, 2.2)))));
    const gl = new Part();
    // glowing frame outlines on every doorway
    doorXs.forEach((dx) => { [[1.56, 0], [-1.56, Math.PI]].forEach((dz) => {
      const m = mat(dx, 0, dz[0], 0, dz[1], 0);
      gl.within(m, () => { gl.box(G.access.solid, 1.2, 0.06, 0.06, 0, 2.18, 0.08); gl.box(G.access.solid, 0.06, 2.18, 0.06, -0.57, 1.09, 0.08); gl.box(G.access.solid, 0.06, 2.18, 0.06, 0.57, 1.09, 0.08); });
    }); });
    gl.within(mat(-6, 0, 0, 0, -Math.PI / 2, 0), () => { gl.box(G.access.solid, 1.2, 0.06, 0.06, 0, 2.18, 0.08); gl.box(G.access.solid, 0.06, 2.18, 0.06, -0.57, 1.09, 0.08); gl.box(G.access.solid, 0.06, 2.18, 0.06, 0.57, 1.09, 0.08); });
    acc.add(gl.build());
    const panel = new Part();
    panel.box(M.rackBlack, 0.5, 0.65, 0.12, -HX + 0.2, 1.4, -1.2, 0, Math.PI / 2);
    panel.box(M.rackBlack, 0.44, 0.58, 0.02, -HX + 0.27, 1.4, -1.2, 0, Math.PI / 2);
    acc.add(panel.build());
    const lm = []; for (let i = 0; i < 4; i++) lm.push(mat(-HX + 0.29, 1.58 - i * 0.08, -1.2 + 0.1, 0, 0, 0, 1, 1, 1));
    acc.add(instanced(G_.led, G.access.led, lm));
    // dashed runs: reader -> up the wall -> across the plenum to one shared trunk -> IDF panel
    const dm = [];
    let maxX = -99;
    rd.forEach((m) => {
      const p0 = V().setFromMatrixPosition(m);
      maxX = Math.max(maxX, p0.x);
      const pts = [p0];
      if (p0.z > 5) pts.push(V(p0.x, p0.y, HZ - 0.3));   // lobby reader: through the wall first, then up inside
      pts.push(V(p0.x, 3.28, pts[pts.length - 1].z), V(p0.x, 3.28, 0.55));
      dashMatrices(pts, 0.22, 0.14, 0.012).forEach((x) => dm.push(x));
    });
    dashMatrices([V(maxX, 3.28, 0.55), V(-11.55, 3.28, 0.55), V(-11.55, 3.28, -1.2), V(-11.55, 1.85, -1.2)], 0.22, 0.14, 0.012).forEach((x) => dm.push(x));
    acc.add(instanced(G_.dashCyl, G.access.solid, dm));
    g.add(reg(acc, 'access', 7));
  }

  // Backbone between floors: scaled cylinders, re-spanned every frame as floors lift
  const bbA = new Mesh(new CylinderGeometry(0.021, 0.021, 1, 8), G.fiber.cable);
  const bbB = new Mesh(new CylinderGeometry(0.03, 0.03, 1, 8), G.cabling.cable);
  const bbA2 = bbA.clone(), bbB2 = bbB.clone();
  [bbA, bbA2].forEach((m) => { m.userData.baseMat = G.fiber.cable; });
  [bbB, bbB2].forEach((m) => { m.userData.baseMat = G.cabling.cable; });
  const riserGrp = new Group(); riserGrp.add(bbA, bbB, bbA2, bbB2);
  world.add(reg(riserGrp, 'fiber', 3));
  // the copper half of the riser is cabling; register separately so the picker isolates correctly
  riserGrp.remove(bbB, bbB2);
  const riserCu = new Group(); riserCu.add(bbB, bbB2);
  world.add(reg(riserCu, 'cabling', 3));
  function spanRiser() {
    const y = (i) => floors[i].position.y;
    [[0, 1, bbA, bbB], [1, 2, bbA2, bbB2]].forEach((s) => {
      const y0 = y(s[0]) + 2.3, y1 = y(s[1]) + 2.3;
      s[2].scale.set(1, y1 - y0, 1); s[2].position.set(sleeveXZ[0] - 0.03, (y0 + y1) / 2, sleeveXZ[1]);
      s[3].scale.set(1, y1 - y0, 1); s[3].position.set(sleeveXZ[0] + 0.05, (y0 + y1) / 2, sleeveXZ[1]);
    });
  }

  /* ---------- state, camera damping, render on demand ---------- */
  const state = { stage: 1, focus: '' };
  const cur = { pos: new Vector3(), tgt: new Vector3(), off: [0, 0, 0], glass: 0.8, fov: 34, glow: { fiber: 0, cabling: 0, wireless: 0, surveillance: 0, access: 0 }, field: { wireless: 0, surveillance: 0 }, beads: 0, dim: 0 };
  const goal = { pos: new Vector3(), tgt: new Vector3(), off: [0, 0, 0], glass: 0.8, fov: 34, glow: { fiber: 0, cabling: 0, wireless: 0, surveillance: 0, access: 0 }, field: { wireless: 0, surveillance: 0 }, beads: 0, dim: 0 };
  let running = false, onscreen = true, lastT = 0, frames = 0, destroyed = false, snap = !!options.reduceMotion;

  function setGoal() {
    const st = state.focus ? 8 : state.stage;
    const P = poseOf(state.stage, state.focus);
    goal.pos.set(P.pos[0], P.pos[1], P.pos[2]); goal.tgt.set(P.tgt[0], P.tgt[1], P.tgt[2]);
    goal.off = P.off.slice(); goal.glass = P.glass; goal.fov = P.fov;
    Object.keys(COL).forEach((k, i) => { goal.glow[k] = (st >= i + 1 || k === 'fiber' && st >= 1) ? 1 : 0; });
    goal.glow.fiber = st >= 1 ? 1 : 0;
    goal.glow.cabling = st >= 2 ? 1 : 0; goal.glow.wireless = st >= 5 ? 1 : 0; goal.glow.surveillance = st >= 6 ? 1 : 0; goal.glow.access = st >= 7 ? 1 : 0;
    goal.field.wireless = (st === 5 || st === 8) ? 1 : 0; goal.field.surveillance = (st === 6 || st === 8) ? 1 : 0;
    goal.beads = st >= 1 ? 1 : 0;
    goal.dim = state.focus ? 1 : 0;
    if (state.focus) { // isolate: the focused system glows, others are ghosted
      Object.keys(COL).forEach((k) => { goal.glow[k] = k === state.focus ? 1.4 : 0; });
      goal.field.wireless = state.focus === 'wireless' ? 1 : 0; goal.field.surveillance = state.focus === 'surveillance' ? 1 : 0;
    }
  }

  function applyVisibility() {
    const st = state.focus ? 8 : state.stage;
    items.forEach((it) => {
      const on = st >= it.from;
      it.obj.visible = on;
      if (!on) return;
      const ghost = !!state.focus && it.sys !== state.focus;
      it.obj.traverse((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        if (o.userData.field) { o.visible = !ghost; return; }
        const base = o.userData.baseMat || o.material;
        if (!o.userData.baseMat) o.userData.baseMat = base;
        o.material = ghost ? M.ghost : o.userData.baseMat;
      });
    });
  }

  function frameStep(dt) {
    const k = snap ? 1 : 1 - Math.exp(-4.2 * dt);
    let moving = false;
    function step(a, b) { const d = b - a; if (Math.abs(d) < 1e-3) return b; moving = true; return a + d * k; }
    cur.pos.set(step(cur.pos.x, goal.pos.x), step(cur.pos.y, goal.pos.y), step(cur.pos.z, goal.pos.z));
    cur.tgt.set(step(cur.tgt.x, goal.tgt.x), step(cur.tgt.y, goal.tgt.y), step(cur.tgt.z, goal.tgt.z));
    for (let i = 0; i < 3; i++) cur.off[i] = step(cur.off[i], goal.off[i]);
    cur.glass = step(cur.glass, goal.glass); cur.fov = step(cur.fov, goal.fov); cur.beads = step(cur.beads, goal.beads);
    Object.keys(COL).forEach((c) => { cur.glow[c] = step(cur.glow[c], goal.glow[c]); });
    cur.field.wireless = step(cur.field.wireless, goal.field.wireless); cur.field.surveillance = step(cur.field.surveillance, goal.field.surveillance);
    floors[0].position.y = 0; floors[1].position.y = FH + cur.off[0]; floors[2].position.y = 2 * FH + cur.off[1]; roof.position.y = 3 * FH + cur.off[2];
    spanRiser();
    camera.fov = cur.fov; camera.position.copy(cur.pos); camera.lookAt(cur.tgt); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    M.glass.opacity = cur.glass;
    Object.keys(COL).forEach((c) => { Object.keys(G[c]).forEach((kk) => { const m = G[c][kk]; if (m.userData.glow) m.emissiveIntensity = m.userData.glow * cur.glow[c]; }); });
    G.wireless.field.opacity = FIELD_OPACITY.wireless * Math.min(1, cur.field.wireless);
    G.surveillance.field.opacity = FIELD_OPACITY.surveillance * Math.min(1, cur.field.surveillance);
    beads.count = Math.round(BEADS * Math.min(1, cur.beads));
    // fields hidden when fully faded out so they cost nothing
    scene.traverse((o) => { if (o.userData && o.userData.field) o.visible = (state.focus ? o.userData.field === state.focus : true) && (cur.field[o.userData.field] > 0.01); });
    return moving;
  }

  function tick(t) {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000)); lastT = t;
    const moving = frameStep(dt);
    renderer.render(scene, camera);
    frames++; window.__hybHome3d && (window.__hybHome3d.frames = frames);
    if (moving && onscreen && !document.hidden) requestAnimationFrame(tick); else running = false;
  }
  function invalidate() {
    if (running || destroyed || !onscreen || document.hidden || !sized) return;
    running = true; lastT = performance.now() - 16; requestAnimationFrame(tick);
  }

  /* ---------- sizing: the canvas fills the model band; label bands stay free ---------- */
  const VB = { w: 640, h: 600 }, DRAW = { x: 0, y: 78, w: 640, h: 462 };
  let sized = false, scl = 1;
  function fit() {
    const W = frame.clientWidth, H = frame.clientHeight;
    if (!W || !H) return;
    scl = Math.min(W / VB.w, H / VB.h);
    const ox = (W - VB.w * scl) / 2, oy = (H - VB.h * scl) / 2;
    const cw = Math.round(DRAW.w * scl), ch = Math.round(DRAW.h * scl);
    canvas.style.position = 'absolute';
    canvas.style.left = Math.round(ox + DRAW.x * scl) + 'px'; canvas.style.top = Math.round(oy + DRAW.y * scl) + 'px';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(cw, ch, false);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    sized = true;
    placeLabels(); invalidate();
  }
  const ro = new ResizeObserver(fit); ro.observe(frame);
  const io = new IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; if (onscreen) invalidate(); }, { rootMargin: '80px' });
  io.observe(frame);
  document.addEventListener('visibilitychange', invalidate);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; });
  canvas.addEventListener('webglcontextrestored', () => { invalidate(); });

  /* ---------- labels: project each anchor with the TARGET camera and floor lifts ---------- */
  const S = window.HybStage;
  const labels = S.createLabels({ frame, vb: VB, draw: DRAW, mode: 'tb', max: 3 });
  const tmpCam = new PerspectiveCamera();
  function placeLabels() {
    if (!sized) return;
    const st = state.focus ? 8 : state.stage;
    const list = state.focus ? FOCUS_LABELS[state.focus] : STAGE_LABELS[st];
    const P = poseOf(state.stage, state.focus);
    tmpCam.fov = P.fov; tmpCam.aspect = camera.aspect; tmpCam.near = 0.5; tmpCam.far = 400;
    tmpCam.position.set(P.pos[0], P.pos[1], P.pos[2]); tmpCam.lookAt(P.tgt[0], P.tgt[1], P.tgt[2]); tmpCam.updateProjectionMatrix(); tmpCam.updateMatrixWorld();
    const out = [];
    (list || []).forEach((l) => {
      const fy = l.f < 0 ? 0 : l.f * FH + (l.f === 0 ? 0 : P.off[l.f - 1]);
      const v = new Vector3(l.p[0], l.p[1] + fy, l.p[2]).project(tmpCam);
      const cw = DRAW.w * scl, ch = DRAW.h * scl;
      const px = (v.x * 0.5 + 0.5) * cw, py = (-v.y * 0.5 + 0.5) * ch;
      const inView = v.z < 1 && px > -4 && px < cw + 4 && py > -4 && py < ch + 4;
      if (!inView) return;
      out.push({ text: l.text, ax: px / scl, ay: DRAW.y + py / scl });
    });
    labels.show(out);
  }

  setGoal(); applyVisibility();
  // start the camera at the first pose without animating in from nowhere
  cur.pos.copy(goal.pos); cur.tgt.copy(goal.tgt); cur.off = goal.off.slice(); cur.glass = goal.glass; cur.fov = goal.fov;

  window.__hybHome3d = { frames: 0, scene: scene, get stage() { return state.stage; }, get focus() { return state.focus; }, get ready() { return sized && pending === 0; }, calls: () => renderer.info.render.calls, tris: () => renderer.info.render.triangles, geometries: () => renderer.info.memory.geometries, textures: () => renderer.info.memory.textures, tier: tier };

  function setState(stage, focus) {
    state.stage = stage; state.focus = focus || '';
    setGoal(); applyVisibility(); placeLabels(); invalidate();
    window.__hybLabelCheck = window.__hybLabelCheck || {};
    window.__hybLabelCheck.home = labels.check;
  }

  let finished = false;
  return new Promise((resolve) => {
    const finish = async () => {
      // Warm every shader once (all stages visible), in parallel where the browser supports it, so no stage change hitches later.
      if (finished) return; finished = true;
      const saved = items.map((it) => it.obj.visible); items.forEach((it) => { it.obj.visible = true; });
      frameStep(0.016);
      scene.traverse((o) => { if (o.userData && o.userData.field) o.visible = true; });
      try { if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { /* first render compiles instead */ }
      items.forEach((it, i) => { it.obj.visible = saved[i]; });
      applyVisibility();
      el.appendChild(canvas); // attached only once everything is loaded and the first frame is drawn
      fit(); frameStep(0.016); renderer.render(scene, camera);
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
