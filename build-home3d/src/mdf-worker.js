/* Worker entry: the rack scene runs off the main thread, drawing into a transferred OffscreenCanvas.
   Messages in: init {canvas, width, height, dpr, phone, reduced, step, focus}, state, size, pointer, wheel, pose.
   Messages out: ready, fail {reason}. */
import { create } from './mdf-core.js';

let rack = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.t === 'init') {
    try { rack = create(m.canvas, m); self.postMessage({ t: 'ready' }); }
    catch (err) { self.postMessage({ t: 'fail', reason: String((err && err.message) || err) }); }
    return;
  }
  if (!rack) return;
  if (m.t === 'state') rack.setState(m.step, m.focus);
  else if (m.t === 'size') rack.setSize(m.w, m.h, m.dpr);
  else if (m.t === 'pointer') rack.pointer(m.k, m.id, m.x, m.y);
  else if (m.t === 'wheel') rack.wheel(m.dy);
  else if (m.t === 'pose') rack.pose(m.pose);
};
