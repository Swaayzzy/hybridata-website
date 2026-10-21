/* Worker entry: the warehouse scene runs off the main thread, drawing into a transferred OffscreenCanvas.
   Messages in: init {canvas, width, height, dpr, phone, reduced, step}, state, size, pointer, wheel, pose.
   Messages out: ready, fail {reason}. */
import { create } from './wh-core.js';

let scene = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.t === 'init') {
    try { scene = create(m.canvas, m); self.postMessage({ t: 'ready' }); }
    catch (err) { self.postMessage({ t: 'fail', reason: String((err && err.message) || err) }); }
    return;
  }
  if (!scene) return;
  if (m.t === 'state') scene.setState(m.step, m.focus);
  else if (m.t === 'size') scene.setSize(m.w, m.h, m.dpr);
  else if (m.t === 'pointer') scene.pointer(m.k, m.id, m.x, m.y);
  else if (m.t === 'wheel') scene.wheel(m.dy);
  else if (m.t === 'pose') scene.pose(m.pose);
};
