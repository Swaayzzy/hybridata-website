import sys
from lib25 import *

S, OX, OY = 33, 118, 476
P = Proj(S, OX, OY, k=0.6)
W, D, H, T = 9.0, 2.6, 3.4, 0.2
CY, CA, CG, CP, CO = '#53c3df', '#e0a85a', '#7fe3a0', '#c79bff', '#ff9a6b'

def defs():
    d = []
    d.append(lin('bg', [(0, '#16252d'), (1, '#0a1116')], 0.5, 0, 0.5, 1))
    d.append(lin('earthF', [(0, '#1d2c33'), (1, '#0c1419')]))
    d.append(lin('earthT', [(0, '#2a3d45'), (1, '#1a2a31')]))
    d.append(lin('wallB', [(0, '#283942'), (1, '#1a262d')]))
    d.append(lin('wallL', [(0, '#1f2d35'), (1, '#16212a')], 0, 0, 1, 0))
    d.append(lin('floorT', [(0, '#3b4f59'), (1, '#2a3b44')]))
    d.append(lin('slabF', [(0, '#667880'), (1, '#46565e')]))
    d.append(lin('glassT', [(0, '#9fc9d8', .20), (1, '#53c3df', .07)]))
    d.append(lin('rackF', [(0, '#2b3b44'), (1, '#18242b')]))
    d.append(lin('rackT', [(0, '#41565f'), (1, '#2e3f47')]))
    d.append(lin('rackS', [(0, '#1b282f'), (1, '#0f181d')], 0, 0, 1, 0))
    d.append(lin('apG', [(0, '#ffffff'), (1, '#b9efca')]))
    d.append(rad('bloomG', [(0, CG, .5), (.6, CG, .16), (1, CG, 0)]))
    d.append(lin('coneP', [(0, CP, .55), (1, CP, 0)], 0, 0, 1, 0))
    d.append(lin('coneP2', [(0, CP, .55), (1, CP, 0)], 1, 0, 0, 0))
    d.append(lin('coneP3', [(0, CP, .55), (1, CP, 0)], 0, 0, 0, 1))
    d.append(lin('doorG', [(0, '#1b3b49'), (1, '#0a1419')], 0, 0, 1, 1))
    d.append(rad('glowBg', [(0, '#2b5a6e', .42), (1, '#2b5a6e', 0)]))
    d.append(lin('road', [(0, '#202c32'), (1, '#161f25')]))
    d.append('<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>')
    d.append('<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    d.append('<filter id="gl2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>')
    return '<defs>%s</defs>' % ''.join(d)

def glowline(dpath, color, sw=3.2, dash='9 7', halo=True):
    s = ''
    if halo:
        s += path(dpath, color, sw + 5, op=.28, extra='filter="url(#gl2)"')
    s += path(dpath, '#0c161c', sw + 2.6)
    s += path(dpath, color, sw, dash=dash)
    return s

def P2(x, y, z):
    return P.p(x, y, z)

def mk(narrow=False):
    o = []
    VW, VH = 640, 600
    o.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" role="img" aria-labelledby="hs8-t hs8-d" focusable="false" preserveAspectRatio="xMidYMid meet">')
    o.append('<title id="hs8-t">Everything on: cutaway of a generic three-storey commercial building</title>')
    o.append('<desc id="hs8-d">Layered 2.5D cutaway. OSP fiber enters from a street handhole to the MDF, the riser climbs to an IDF stacked on each floor, a tray above the ceiling carries J-hooks to outlets, ceiling access points show an illustrative coverage ripple, cameras look inward from entries, corridors and parking, and readers sit on the latch-side jamb.</desc>')
    o.append(defs())
    o.append(rect(0, 0, VW, VH, 'url(#bg)'))
    o.append(ell(330, 300, 300, 240, 'url(#glowBg)'))
    # ---------- ground + earth cut ----------
    ex0, ex1, ey0, ey1, ed = -3.3, 13.0, -1.1, D + .5, 2.0
    # shadow under the building
    o.append(poly(P, [P2(-.2, -.1, 0), P2(W + .9, -.1, 0), P2(W + 1.6, D + .3, 0), P2(.5, D + .3, 0)], '#000', op=.55, extra='filter="url(#sh)"'))
    o.append(poly(P, [P2(ex0, ey0, 0), P2(ex1, ey0, 0), P2(ex1, ey1, 0), P2(ex0, ey1, 0)], 'url(#earthT)'))
    # sidewalk + kerb strip along the front
    o.append(poly(P, [P2(ex0, ey0, 0), P2(ex1, ey0, 0), P2(ex1, ey0 + .55, 0), P2(ex0, ey0 + .55, 0)], '#3b4d56'))
    # parking: bays on the right
    for i in range(4):
        x = W + .9 + i * .9
        o.append(path('M%s %s L%s %s' % (*P2(x, .15, 0), *P2(x + .12, 2.6, 0)), '#9fb2ba', 1.6, op=.45))
    o.append(poly(P, [P2(W + .6, -.05, 0), P2(ex1, -.05, 0), P2(ex1, D, 0), P2(W + .6, D, 0)], '#1a262d', op=.45))
    # earth front face (section)
    o.append(poly(P, [P2(ex0, ey0, 0), P2(ex1, ey0, 0), P2(ex1, ey0, -ed), P2(ex0, ey0, -ed)], 'url(#earthF)'))
    o.append(path('M%s %s L%s %s' % (*P2(ex0, ey0, -0.02), *P2(ex1, ey0, -0.02)), '#5b7480', 1.2, op=.6))
    # ---------- OSP conduit in section + handhole ----------
    hx = -2.5
    hh = P2(hx, ey0 + .3, 0)
    o.append(poly(P, [P2(hx - .4, ey0 + .05, 0), P2(hx + .4, ey0 + .05, 0), P2(hx + .4, ey0 + .65, 0), P2(hx - .4, ey0 + .65, 0)], '#33454e', CY, 1.5))
    o.append(poly(P, [P2(hx - .3, ey0 + .12, 0), P2(hx + .3, ey0 + .12, 0), P2(hx + .3, ey0 + .58, 0), P2(hx - .3, ey0 + .58, 0)], '#0c161c'))
    cond = 'M%s %s L%s %s L%s %s L%s %s' % (*P2(hx, ey0, -.05), *P2(hx, ey0, -1.35), *P2(1.1, ey0, -1.35), *P2(1.1, ey0, .0))
    o.append(glowline(cond, CY, 3.6))
    o.append(path('M%s %s L%s %s' % (*P2(1.1, ey0, 0.01), *P2(1.1, -.05, 0.01)), '#0c161c', 6.6))
    o.append(path('M%s %s L%s %s' % (*P2(1.1, ey0, 0.01), *P2(1.1, -.05, 0.01)), CY, 3.4, dash='9 7', extra='filter="url(#gl)"'))

    zs = [0, H, 2 * H]
    # ---------- floors ----------
    for fl, z0 in enumerate(zs):
        # back wall + left wall
        o.append(poly(P, [P2(0, D, z0), P2(W, D, z0), P2(W, D, z0 + H), P2(0, D, z0 + H)], 'url(#wallB)', '#3a4f5a', 1.2))
        for wx in (3.3, 5.6, 7.9):
            o.append(path('M%s %s L%s %s' % (*P2(wx, D, z0 + .25), *P2(wx, D, z0 + H - .25)), '#38566a', 1.4, op=.55))
        o.append(poly(P, [P2(0, D, z0 + 1.4), P2(W, D, z0 + 1.4), P2(W, D, z0 + 1.55), P2(0, D, z0 + 1.55)], '#9fc9d8', op=.07))
        o.append(poly(P, [P2(0, 0, z0), P2(0, D, z0), P2(0, D, z0 + H), P2(0, 0, z0 + H)], 'url(#wallL)', '#3a4f5a', 1.2))
        # floor plate: top, corridor, front edge
        o.append(poly(P, [P2(0, 0, z0), P2(W, 0, z0), P2(W, D, z0), P2(0, D, z0)], 'url(#floorT)', op=None if fl == 0 else .5))
        o.append(poly(P, [P2(3.0, .8, z0), P2(W, .8, z0), P2(W, 1.8, z0), P2(3.0, 1.8, z0)], '#566a75', op=.38))
        o.append(path('M%s %s L%s %s' % (*P2(3.0, 1.3, z0), *P2(W, 1.3, z0)), '#9fb2ba', 1.2, dash='3 7', op=.45))
        # MDF/IDF room outline
        o.append(poly(P, [P2(0, 0, z0), P2(2.9, 0, z0), P2(2.9, D, z0), P2(0, D, z0)], '#0e1a20', op=.45))
        o.append(path('M%s %s L%s %s' % (*P2(2.9, 0, z0), *P2(2.9, D, z0)), '#8fa4ad', 1.4, op=.5))
        o.append(front(P, 0, 0, z0 - T, W, T, 'url(#slabF)', None, 1, 1))
        o.append(side(P, W, 0, z0 - T, D, T, '#35444b'))
        o.append(path('M%s %s L%s %s' % (*P2(0, 0, z0), *P2(W, 0, z0)), '#ffffff', 1, op=.28))
        # ---- riser segment (passes through this slab) ----
        rx, ry = 2.25, 1.85
        o.append(box(P, rx, ry, z0, .5, .5, H, 'rgba(0,0,0,0)'.replace('rgba(0,0,0,0)', '#0f1b21'), '#1d2d35', '#0b1418', '#3a5360', 1.2))
        bx, by = P2(rx + .21, ry + .1, z0 + .1)
        tx, ty = P2(rx + .21, ry + .1, z0 + H - .05)
        o.append(path('M%s %s L%s %s' % (bx - 3, by, tx - 3, ty), CY, 2.6, dash='8 6', extra='filter="url(#gl)"'))
        o.append(path('M%s %s L%s %s' % (bx + 4, by, tx + 4, ty), CA, 2.6))
        # firestop collar at the slab
        cx0, cy0 = P2(rx - .06, ry - .06, z0 + .02)
        o.append(poly(P, [P2(rx - .08, ry - .08, z0 + .0), P2(rx + .5, ry - .08, z0 + .0), P2(rx + .5, ry + .5, z0 + .0), P2(rx - .08, ry + .5, z0 + .0)], '#8a5a3a', '#c98a5a', 1))
        # ---- IDF / MDF rack ----
        rkx, rky, rkw, rkd = .45, .5, 1.15, .95
        rh = 2.35 if fl == 0 else 2.1
        o.append(box(P, rkx, rky, z0, rkw, rkd, rh, 'url(#rackF)', 'url(#rackT)', 'url(#rackS)', '#4a6270', 1.2, 3))
        fx, fy = P2(rkx, rky, z0 + rh)
        wpx = rkw * S
        # patch/switch bands on the rack face
        yy = fy + 8
        bands = [(CY, 9), (CA, 9), (CA, 9), ('#7fb6c9', 7), ('#7fb6c9', 7), ('#2f4552', 12)]
        for c, hh2 in bands:
            o.append(rect(fx + 5, yy, wpx - 10, hh2, '#0c1a21', c, 1.1, 2, op=.95))
            o.append(rect(fx + 8, yy + 2.5, wpx * .35, 2, c, None, 0, 1, op=.85))
            yy += hh2 + 4
        o.append(circ(fx + wpx - 9, fy + 14, 1.8, CG))
        # ground floor: splice enclosure + TGB bond; upper floors: IDF panel to readers
        if fl == 0:
            o.append(box(P, 1.75, 1.15, z0 + .55, .55, .3, .5, '#17303b', '#274b5a', '#0e2029', CY, 1.2, 2))
            tp = P2(.55, D, z0 + 1.0)
            o.append(rect(tp[0], tp[1], 1.0 * S, 5, CA, '#ffe2b0', .7, 1.5))
            for k_ in range(4):
                o.append(circ(tp[0] + 7 + k_ * 7.5, tp[1] + 2.5, 1.1, '#2a1b0a'))
            rt = P2(1.15, .95, z0 + rh)
            o.append(path('M%s %s C%s %s %s %s %s %s' % (tp[0] + 12, tp[1] + 5, tp[0] + 6, tp[1] + 30, rt[0] + 8, rt[1] - 26, rt[0] + 8, rt[1] - 1), '#9bd36a', 2.4))
        if fl == 0:
            o.append(glowline('M%s %s L%s %s' % (*P2(1.1, 0, z0 + .02), *P2(1.1, .55, z0 + .02)), CY, 3.2, '9 7', False))
        # ---- ceiling plane (translucent tile grid) ----
        cz = z0 + 2.35
        o.append(poly(P, [P2(2.9, 0, cz), P2(W, 0, cz), P2(W, D, cz), P2(2.9, D, cz)], '#bcdde8', '#7fa7b6', 1, op=.085))
        for gx in range(4, 9, 1):
            o.append(path('M%s %s L%s %s' % (*P2(gx, 0, cz), *P2(gx, D, cz)), '#9cc2d1', .8, op=.18))
        for gy in (.9, 1.8):
            o.append(path('M%s %s L%s %s' % (*P2(2.9, gy, cz), *P2(W, gy, cz)), '#9cc2d1', .8, op=.18))
        # ---- tray above the ceiling + J-hooks ----
        tz = cz + .22
        t0, t1 = P2(2.4, 1.5, tz), P2(8.8, 1.5, tz)
        o.append(path('M%s %s L%s %s' % (*P2(2.4, 1.2, tz), *P2(8.8, 1.2, tz)), '#d6e2e8', 3.2))
        o.append(path('M%s %s L%s %s' % (*P2(2.4, 1.42, tz), *P2(8.8, 1.42, tz)), '#d6e2e8', 3.2))
        for tx_ in [2.6 + i * .42 for i in range(16)]:
            o.append(path('M%s %s L%s %s' % (*P2(tx_, 1.2, tz), *P2(tx_, 1.42, tz)), '#7d909a', 1.2))
        o.append(path('M%s %s L%s %s' % (*P2(2.3, 1.3, tz - .05), *P2(2.4, 1.3, tz)), CA, 2.6))
        o.append(path('M%s %s L%s %s' % (*P2(2.4, 1.31, tz + .06), *P2(8.8, 1.31, tz + .06)), CA, 2.4, dash='8 6'))
        for jx, jy in [(5.5, .45), (7.5, .45), (6.5, 2.15)]:
            # J-hook branch off the tray: stub to a hook, then a drop through the ceiling to the outlet
            sy_ = 1.3
            o.append(path('M%s %s L%s %s' % (*P2(jx, sy_, tz), *P2(jx, jy, tz)), '#c9d6dc', 2))
            hk = P2(jx, jy, tz)
            o.append(path('M%s %s q0 -7 6 -7 q6 0 6 7' % (hk[0] - 6, hk[1] + 0), '#c9d6dc', 2))
            o.append(path('M%s %s L%s %s' % (*P2(jx, jy, tz), *P2(jx, jy, z0 + .85)), CA, 1.6, dash='3 3'))
            ox_, oy_ = P2(jx, jy, z0 + .85)
            o.append(rect(ox_ - 5, oy_, 10, 7, CA, '#2a1b0a', .6, 1))
        # ---- access points in the ceiling + illustrative coverage ripple ----
        for ax, ay in [(5.5, .45), (7.5, .45), (6.5, 2.15)]:
            fp = P2(ax, ay, z0)
            for r, a in [(1.25, .55), (.8, .4)]:
                o.append('<ellipse %s/>' % attrs(cx=f(fp[0] + 0), cy=f(fp[1] - .06 * S), rx=f(r * S * 1.0), ry=f(r * S * 0.5), fill='url(#bloomG)' if r > 1 else 'none', stroke=CG, stroke_width=1.3, stroke_dasharray='4 5', opacity=a))
            ap = P2(ax, ay, cz)
            o.append(ell(ap[0], ap[1] + 1, 11, 4.4, '#0b161d', op=.6))
            o.append(ell(ap[0], ap[1], 10, 4, 'url(#apG)', CG, 1.8, extra='filter="url(#gl)"'))
        # ---- door + latch-side reader on the back wall ----
        dx0 = 4.9 if fl != 0 else 6.2
        if fl == 0:
            # entry on the front plane
            dpx, dpy = P2(4.0, 0, z0 + 2.05)
            o.append(rect(dpx, dpy, 1.0 * S, 2.05 * S, 'url(#doorG)', CO, 1.8, 2) + path('M%s %s L%s %s' % (dpx + 6, dpy + 2.05 * S - 6, dpx + .55 * S, dpy + 8), '#ffffff', 1.4, op=.14))
            o.append(rect(dpx + 5, dpy + 6, 1.0 * S - 10, 2.05 * S - 6, '#9fc9d8', None, 0, 1, op=.12))
            o.append(rect(dpx + 1.0 * S + 3, dpy + 1.0 * S + 2, 5, 12, CO, '#ffd1ba', .8, 1.5, extra='filter="url(#gl)"'))
        else:
            dpx, dpy = P2(3.4, D, z0 + 2.05)
            o.append(rect(dpx, dpy, 1.0 * S, 2.05 * S, 'url(#doorG)', CO, 1.8, 2) + path('M%s %s L%s %s' % (dpx + 6, dpy + 2.05 * S - 6, dpx + .55 * S, dpy + 8), '#ffffff', 1.4, op=.14))
            o.append(rect(dpx + 1.0 * S + 3, dpy + 1.0 * S + 2, 5, 12, CO, '#ffd1ba', .8, 1.5, extra='filter="url(#gl)"'))
        o.append(box(P, 2.2, .3, z0 + .5, .5, .25, .6, '#2a2030', '#3c2d3f', '#1b1422', CO, 1.1, 2))
        if fl == 0:
            rd = [P2(5.1, 0, z0 + 1.0), P2(5.1, 0, tz), P2(5.1, 1.15, tz), P2(2.45, 1.15, tz), P2(2.45, .3, tz), P2(2.45, .3, z0 + 1.1)]
        else:
            rd = [P2(4.5, D, z0 + 1.0), P2(4.5, D, tz), P2(4.5, 1.15, tz), P2(2.45, 1.15, tz), P2(2.45, .3, tz), P2(2.45, .3, z0 + 1.1)]
        o.append(path('M' + ' L'.join('%s %s' % c for c in rd), CO, 1.8, dash='5 4', op=.9))
        # ---- horizontal run entering the corridor from the riser ----
        o.append(path('M%s %s L%s %s' % (*P2(2.46, 1.95, tz), *P2(2.46, 1.3, tz)), CA, 2.4))
        # ---- corridor / entry cameras looking inward ----
        if fl == 0:
            lens = P2(4.5, .12, z0 + 2.3)
            tgt1, tgt2 = P2(3.3, 2.4, z0), P2(6.4, 1.6, z0)
            o.append('<path %s/>' % attrs(d='M%s %s L%s %s Q%s %s %s %s Z' % (*lens, *tgt1, *P2(4.9, 2.6, z0 - .0), *tgt2), fill='url(#coneP3)', opacity=.85))
            o.append(rect(lens[0] - 7, lens[1] - 4, 14, 8, '#2a2438', CP, 1.6, 3))
            o.append(circ(lens[0] - 4, lens[1], 2.2, '#f0e6ff'))
        else:
            lens = P2(8.75, 1.3, z0 + 2.25)
            tgt1, tgt2 = P2(3.7, .15, z0), P2(5.3, 2.3, z0)
            o.append('<path %s/>' % attrs(d='M%s %s L%s %s Q%s %s %s %s Z' % (*lens, *tgt1, *P2(3.9, 1.3, z0), *tgt2), fill='url(#coneP2)', opacity=.8))
            o.append(rect(lens[0] - 7, lens[1] - 4, 14, 8, '#2a2438', CP, 1.6, 3))
            o.append(circ(lens[0] - 4, lens[1], 2.2, '#f0e6ff'))
    # right glass wall + roof ghost
    o.append(side(P, W, 0, 0, D, 3 * H, '#9fc9d8', '#7fa7b6', 1, .05))
    o.append(poly(P, [P2(-.2, -.15, 3 * H), P2(W + .2, -.15, 3 * H), P2(W + .2, D + .15, 3 * H), P2(-.2, D + .15, 3 * H)], 'none', '#8fa4ad', 1.4, .5, extra='stroke-dasharray="6 6"'))
    # parking pole camera
    px_, py_ = P2(12.0, .9, 0)
    lens = P2(12.0, .9, 3.0)
    o.append(ell(px_, py_ + 2, 9, 3.4, '#000', op=.5))
    o.append(path('M%s %s L%s %s' % (px_, py_, lens[0], lens[1] + 4), '#9fb2ba', 3.2))
    t1_, t2_ = P2(9.6, .3, 0), P2(10.6, 2.7, 0)
    o.append('<path %s/>' % attrs(d='M%s %s L%s %s Q%s %s %s %s Z' % (*lens, *t1_, *P2(9.5, 1.5, 0), *t2_), fill='url(#coneP2)', opacity=.85))
    o.append(rect(lens[0] - 8, lens[1] - 4, 15, 8, '#2a2438', CP, 1.6, 3))
    o.append(circ(lens[0] - 4, lens[1], 2.2, '#f0e6ff'))
    # access panel wiring: reader (entry) back to the IDF, dashed
    r0 = P2(6.95, 0.05, 1.1)
    # ---------- labels ----------
    lab = []
    fs = 17 if narrow else 12.5
    def width(t):
        return len(t) * fs * 0.56 + 14
    def L(anchor, col, pos, t):
        w, h = width(t), fs + 9
        if col == 'L':
            ex_, ey_ = pos[0] + w, pos[1]
            lab.append(pill(pos[0], pos[1], t, fs, 'start'))
        elif col == 'R':
            ex_, ey_ = pos[0] - w, pos[1]
            lab.append(pill(pos[0], pos[1], t, fs, 'end'))
        elif col == 'T':
            ex_, ey_ = pos[0], pos[1] + h / 2
            lab.append(pill(pos[0], pos[1], t, fs, 'mid'))
        else:
            ex_, ey_ = pos[0], pos[1] - h / 2
            lab.append(pill(pos[0], pos[1], t, fs, 'mid'))
        lab.insert(0, path('M%s %s L%s %s' % (anchor[0], anchor[1], ex_, ey_), '#9fb2ba', 1, op=.85))
        lab.insert(1, circ(anchor[0], anchor[1], 2.6, '#e6eef1'))
    z3 = 2 * H
    rip = P2(7.5, .45, z3)
    allitems = [
        ('osp', 'OSP fiber from the street', P2(-1.1, ey0, -1.35), 'B', (118, 566)),
        ('mdf', 'MDF', P2(1.1, .5, 1.45), 'L', (8, 396)),
        ('tgb', 'TGB bond', P2(.55, D, 1.0), 'L', (8, 452)),
        ('idf', 'IDF', P2(1.1, .5, H + 1.45), 'L', (8, 300)),
        ('riser', 'Riser', P2(2.46, 1.9, z3 + 2.9), 'T', (237, 112)),
        ('cov', 'Coverage (illustrative)', (rip[0] + 1.25 * S * .7, rip[1] + 1), 'R', (632, 92)),
        ('ap', 'AP in ceiling', P2(7.5, .45, z3 + 2.35), 'R', (632, 128)),
        ('jh', 'J-hooks off tray', P2(5.5, .45, z3 + 2.57), 'R', (632, 164)),
        ('cc', 'Corridor camera', P2(8.75, 1.3, z3 + 2.25), 'R', (632, 200)),
        ('pk', 'Parking camera', P2(12.0, .9, 3.0), 'R', (632, 404)),
        ('ent', 'Entry camera', P2(4.5, .12, 2.3), 'B', (330, 560)),
        ('rdr', 'Reader, latch-side jamb', P2(5.0, 0, 1.0), 'B', (470, 560)),
    ]
    keep = ['osp', 'riser', 'cov', 'rdr'] if narrow else [a[0] for a in allitems]
    for key, t, anc, col, pos in allitems:
        if key in keep:
            L(anc, col, pos, t)
    if narrow:
        pass
    o.append('<g>%s</g>' % '\n'.join(lab))
    o.append('</svg>')
    return '\n'.join(o)

if __name__ == '__main__':
    narrow = len(sys.argv) > 1 and sys.argv[1] == 'narrow'
    print(mk(narrow))
