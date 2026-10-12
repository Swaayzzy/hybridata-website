/* Geometry helpers: a Part collects geometry per material and merges it into one mesh per material. */
import {
  Color, Float32BufferAttribute, BoxGeometry, CylinderGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Matrix4, Quaternion, Euler,
  Group, Mesh, InstancedMesh, BufferGeometry
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Tinted material: one shared textured material (vertexColors) drawn with a per-geometry colour,
   so many differently coloured parts merge into one draw call. */
export const T = (base, hex) => ({ isTint: true, base, color: new Color(hex) });
export function tintGeo(geo, color) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  geo.setAttribute('color', new Float32BufferAttribute(a, 3));
  return geo;
}
const WHITE = new Color(1, 1, 1);
export const V = (x, y, z) => new Vector3(x, y, z);
const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _s = new Vector3(), _p = new Vector3();

export function mat(x, y, z, rx, ry, rz, sx, sy, sz) {
  _e.set(rx || 0, ry || 0, rz || 0);
  _q.setFromEuler(_e);
  _p.set(x || 0, y || 0, z || 0);
  _s.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
  return new Matrix4().compose(_p, _q, _s);
}

/* Box with UVs scaled to real size so a tiling texture keeps a constant texel density. tile = metres per texture repeat. */
export function boxGeo(w, h, d, tile) {
  const g = new BoxGeometry(w, h, d);
  if (tile) {
    const uv = g.attributes.uv.array;
    // BoxGeometry faces (4 verts each): +x, -x, +y, -y, +z, -z; typed-array loop (no per-vertex accessor calls)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const su = dims[f][0] / tile, sv = dims[f][1] / tile;
      for (let i = 0; i < 4; i++) { const k = (f * 4 + i) * 2; uv[k] *= su; uv[k + 1] *= sv; }
    }
  }
  return g;
}

/* Cylinder from point a to point b (unit-height geometry placed and scaled). */
export function cylBetween(a, b, r, seg, r2) {
  const len = a.distanceTo(b);
  const g = new CylinderGeometry(r2 === undefined ? r : r2, r, len, seg || 8, 1);
  const dir = b.clone().sub(a).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const m = new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

export function tubeGeo(points, r, seg, radial, tension) {
  const c = new CatmullRomCurve3(points, false, 'catmullrom', tension === undefined ? 0.4 : tension);
  return new TubeGeometry(c, seg || Math.max(8, points.length * 6), r, radial || 6, false);
}

export class Part {
  constructor() { this.b = new Map(); this.xf = null; }
  /* Run fn with every add() placed in the frame given by matrix m. */
  within(m, fn) { const prev = this.xf; this.xf = prev ? prev.clone().multiply(m) : m; fn(this); this.xf = prev; return this; }
  add(material, geo, m) {
    const mm = this.xf ? (m ? this.xf.clone().multiply(m) : this.xf) : m;
    if (mm) geo.applyMatrix4(mm);
    if (material.isTint) { tintGeo(geo, material.color); material = material.base; }
    else if (material.vertexColors) tintGeo(geo, WHITE);
    let a = this.b.get(material);
    if (!a) { a = []; this.b.set(material, a); }
    a.push(geo);
    return this;
  }
  box(material, w, h, d, x, y, z, tile, ry) {
    return this.add(material, boxGeo(w, h, d, tile), mat(x, y, z, 0, ry || 0, 0));
  }
  cyl(material, r, h, x, y, z, rx, ry, rz, seg) {
    return this.add(material, new CylinderGeometry(r, r, h, seg || 12), mat(x, y, z, rx, ry, rz));
  }
  between(material, a, b, r, seg, r2) { return this.add(material, cylBetween(a, b, r, seg, r2)); }
  tube(material, pts, r, seg, radial, tension) { return this.add(material, tubeGeo(pts, r, seg, radial, tension)); }
  build(opts) {
    const g = new Group();
    opts = opts || {};
    this.b.forEach((list, material) => {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      list.forEach((l) => { if (l !== geo) l.dispose(); });
      const m = new Mesh(geo, material);
      m.castShadow = !!opts.cast && (!opts.castOnly || opts.castOnly === material); m.receiveShadow = opts.receive !== false;
      m.userData.baseMat = material;
      g.add(m);
    });
    return g;
  }
}

/* Instanced repeat: one geometry, many matrices. */
export function instanced(geo, material, matrices, opts) {
  if (material.isTint) { if (!geo.attributes.color) tintGeo(geo, material.color); material = material.base; }
  else if (material.vertexColors && !geo.attributes.color) tintGeo(geo, WHITE);
  const im = new InstancedMesh(geo, material, matrices.length);
  for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
  im.instanceMatrix.needsUpdate = true;
  im.userData.baseMat = material;
  im.castShadow = !!(opts && opts.cast);
  im.receiveShadow = !(opts && opts.receive === false);
  im.frustumCulled = false;
  return im;
}

/* Dash matrices along a polyline for a unit cylinder (height 1 along Y). Explicit dash/gap state, no float modulo. */
export function dashMatrices(points, dash, gap, r) {
  const out = [];
  let drawing = true, left = dash;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], len = a.distanceTo(b);
    if (len < 1e-6) continue;
    const dir = b.clone().sub(a).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    let t = 0;
    while (t < len - 1e-6) {
      const l = Math.min(left, len - t);
      if (drawing) out.push(new Matrix4().compose(a.clone().add(dir.clone().multiplyScalar(t + l / 2)), q, new Vector3(r, l, r)));
      t += l; left -= l;
      if (left <= 1e-6) { drawing = !drawing; left = drawing ? dash : gap; }
    }
  }
  return out;
}

export { BufferGeometry };
