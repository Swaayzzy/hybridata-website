"""How We Build, Building tab: layered 30-degree oblique 2.5D cutaway of a generic three-story commercial building.

LIGHT-501 drew the still; LIGHT-503 extends this generator so that every one of the 8 stages has its own layers and
applies the six review fixes (APs in the ceiling grid off the tray, bigger building, OSP conduit up a floor sleeve into
the MDF rack, per-step callouts with a bounding-box check, "(illustrative)" on the ripple, ladder-rack depth on the rack).
Output is pure SVG: presentation attributes only, no style="", no raster, no scripts.
"""
import math
import sys
from lib25 import *

S, OX, OY = 46.5, 33, 495
P = Proj(S, OX, OY, k=0.6)
W, D, H, T = 11.0, 2.6, 3.0, 0.2
CY, CA, CG, CP, CO = '#53c3df', '#e0a85a', '#7fe3a0', '#c79bff', '#ff9a6b'
VB = {'w': (0, 0, 640, 620), 'n': (0, 20, 640, 571)}     # wide frame / phone crop (building ~90% of the width in both)
FS_W, FS_N = 13, 19
ID = 'h-'
FY = -1.9                                                 # front face of the earth block (the cut)
HH = (1.1, -1.6)                                          # handhole on the sidewalk
SLV = (1.1, 0.3)                                          # floor sleeve in the entrance room, in front of the MDF rack
CEIL, TRAY = 2.3, 2.62
TRAY_Y = 1.9                                              # tray centre line, toward the back wall
AP_X, AP_Y = (5.2, 7.7, 10.2), 0.95                       # APs sit in the ceiling grid between the tray (y 1.9) and the outer wall (front, y 0)
JH_X = (5.9, 7.7, 9.6)                                    # J-hook branches to outlets on the back wall


def U(n):
    return 'url(#%s%s)' % (ID, n)


def P2(x, y, z):
    return P.p(x, y, z)


def pl(*pts3):
    return 'M' + ' L'.join('%s %s' % (f(a), f(b)) for a, b in (P2(*p) for p in pts3))


def defs():
    d = []
    A = lambda n: ID + n
    d.append(lin(A('bg'), [(0, '#16252d'), (1, '#0a1116')], 0.5, 0, 0.5, 1))
    d.append(lin(A('earthF'), [(0, '#1d2c33'), (1, '#0c1419')]))
    d.append(lin(A('earthT'), [(0, '#2a3d45'), (1, '#1a2a31')]))
    d.append(lin(A('wallB'), [(0, '#283942'), (1, '#1a262d')]))
    d.append(lin(A('wallL'), [(0, '#1f2d35'), (1, '#16212a')], 0, 0, 1, 0))
    d.append(lin(A('floorT'), [(0, '#3b4f59'), (1, '#2a3b44')]))
    d.append(lin(A('slabF'), [(0, '#667880'), (1, '#46565e')]))
    d.append(lin(A('rackF'), [(0, '#2b3b44'), (1, '#18242b')]))
    d.append(lin(A('rackT'), [(0, '#41565f'), (1, '#2e3f47')]))
    d.append(lin(A('rackS'), [(0, '#1b282f'), (1, '#0f181d')], 0, 0, 1, 0))
    d.append(lin(A('apG'), [(0, '#ffffff'), (1, '#b9efca')]))
    d.append(rad(A('bloomG'), [(0, CG, .5), (.6, CG, .16), (1, CG, 0)]))
    d.append(lin(A('doorG'), [(0, '#1b3b49'), (1, '#0a1419')], 0, 0, 1, 1))
    d.append(lin(A('glass'), [(0, '#274a5a'), (1, '#0f2029')], 0, 0, 1, 1))
    d.append(rad(A('glowBg'), [(0, '#2b5a6e', .42), (1, '#2b5a6e', 0)]))
    d.append('<filter id="%ssh" x="-20%%" y="-20%%" width="140%%" height="160%%"><feGaussianBlur stdDeviation="7"/></filter>' % ID)
    d.append('<filter id="%sgl" x="-30%%" y="-30%%" width="160%%" height="160%%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' % ID)
    for fl in range(3):
        z0 = fl * H
        d.append('<clipPath id="%sfp%d"><polygon points="%s"/></clipPath>' % (ID, fl, pts([P2(0, 0, z0), P2(W, 0, z0), P2(W, D, z0), P2(0, D, z0)])))
    return '<defs>%s</defs>' % ''.join(d)


def rack_face(sc, fl, z0, frm, rh):
    """The MDF (floor 0) / IDF (floors 1, 2) rack: box + unit bands. Returns anchors."""
    rkx, rky, rkw, rkd = .45, .5, 1.15, .95
    cls = 'unit u%d' % (fl + 1)
    sc.add(box(P, rkx, rky, z0, rkw, rkd, rh, U('rackF'), U('rackT'), U('rackS'), '#4a6270', 1.2, 3), 2, frm, 'cabling')
    fx, fy = P2(rkx, rky, z0 + rh)
    wpx = rkw * S
    yy = fy + 9
    bands = [(CY, 11, 'fe'), (CA, 11, 'cp'), (CA, 11, 'cp'), ('#7fb6c9', 8, 'sw'), ('#7fb6c9', 8, 'sw'), ('#2f4552', 14, 'ups' if fl == 0 else 'sw')]
    parts = []
    for c, hh, k in bands:
        parts.append(rect(fx + 6, yy, wpx - 12, hh, '#0c1a21', c, 1.1, 2, op=.95))
        parts.append(rect(fx + 9, yy + 3, wpx * .35, 2.4, c, None, 0, 1, op=.85))
        yy += hh + 5
    parts.append(circ(fx + wpx - 10, fy + 15, 2, CG))
    sc.add(parts, 2, frm, 'cabling')
    return dict(face=(fx, fy), wpx=wpx, rh=rh)


def build():
    sc = Scene()
    A = {}
    # ---------- backdrop (px 0) ----------
    sc.add(rect(-300, -200, 1240, 1100, U('bg')), 0)
    sc.add(ell(330, 300, 330, 280, U('glowBg')), 0)
    # ---------- ground + earth cut (px 0) ----------
    ex0, ex1, ed = -4.0, 15.0, 1.5
    sc.add(poly(P, [P2(-.2, -.1, 0), P2(W + 1.0, -.1, 0), P2(W + 1.8, D + .3, 0), P2(.6, D + .3, 0)], '#000', op=.55, extra='filter="url(#%ssh)"' % ID), 0)
    sc.add(poly(P, [P2(ex0, FY, 0), P2(ex1, FY, 0), P2(ex1, D + .8, 0), P2(ex0, D + .8, 0)], U('earthT')), 0)
    # sidewalk + curb strip along the front, parking bays on the lot beside the entrance
    sc.add(poly(P, [P2(ex0, FY, 0), P2(ex1, FY, 0), P2(ex1, FY + .5, 0), P2(ex0, FY + .5, 0)], '#3b4d56'), 0)
    sc.add(path('M%s %s L%s %s' % (*P2(ex0, FY + .5, 0), *P2(ex1, FY + .5, 0)), '#9fb2ba', 1.3, op=.5), 0)
    sc.add(poly(P, [P2(6.0, -1.5, 0), P2(W + .9, -1.5, 0), P2(W + .9, -.15, 0), P2(6.0, -.15, 0)], '#1a262d', op=.5), 0)
    for i in range(7):
        x = 6.3 + i * .78
        sc.add(path('M%s %s L%s %s' % (*P2(x, -1.45, 0), *P2(x + .1, -.25, 0)), '#9fb2ba', 1.8, op=.5), 0)
    # earth section (the cut face)
    sc.add(poly(P, [P2(ex0, FY, 0), P2(ex1, FY, 0), P2(ex1, FY, -ed), P2(ex0, FY, -ed)], U('earthF')), 0)
    sc.add(path('M%s %s L%s %s' % (*P2(ex0, FY, -.02), *P2(ex1, FY, -.02)), '#5b7480', 1.2, op=.6), 0)
    # ---------- OSP: handhole, underground conduit, floor sleeve (stage 1, fiber) ----------
    hx, hy = HH
    sx, sy = SLV
    sc.add(poly(P, [P2(hx - .45, hy - .28, 0), P2(hx + .45, hy - .28, 0), P2(hx + .45, hy + .28, 0), P2(hx - .45, hy + .28, 0)], '#33454e', CY, 1.6)
           + poly(P, [P2(hx - .34, hy - .2, 0), P2(hx + .34, hy - .2, 0), P2(hx + .34, hy + .2, 0), P2(hx - .34, hy + .2, 0)], '#0c161c'), 0, 1, 'fiber')
    cond = pl((hx, hy, -.02), (hx, hy, -1.15), (sx, hy, -1.15), (sx, sy, -1.15), (sx, sy, 0))
    sc.add([path(cond, '#2a3d46', 11, op=.9), path(cond, '#0c161c', 7.5), draw(cond, CY, 3.6, 1, True)], 0, 1, 'fiber')
    # the sleeve through the ground-floor slab, then the stub up into the base of the MDF rack
    sc.add(poly(P, [P2(sx - .22, sy - .16, 0), P2(sx + .22, sy - .16, 0), P2(sx + .22, sy + .16, 0), P2(sx - .22, sy + .16, 0)], '#8a5a3a', '#c98a5a', 1.4)
           + poly(P, [P2(sx - .13, sy - .1, 0), P2(sx + .13, sy - .1, 0), P2(sx + .13, sy + .1, 0), P2(sx - .13, sy + .1, 0)], '#0c161c'), 2, 2, 'fiber')
    stub = pl((sx, sy, 0), (sx, sy, .38), (sx, .5, .38))
    sc.add([path(stub, '#0c161c', 8), draw(stub, CY, 4, 1, False)], 2, 2, 'fiber')
    A['sleeve'] = P2(sx, sy, .2)
    # stage 1: the fiber runs into the closed building (a short glow at the wall, under the facade)
    sc.add(path(pl((sx, sy, 0.01), (sx, 0, 0.01)), CY, 3.4, op=.9), 0, 1, 'fiber', 'stage1')

    zs = [fl * H for fl in range(3)]
    anchors = {}
    for fl, z0 in enumerate(zs):
        up = fl > 0
        frm = 3 if up else 2
        cls = 'up' if up else ''
        cz, tz = z0 + CEIL, z0 + TRAY
        rh = 2.35 if fl == 0 else 2.1
        # ----- shell: back wall, left wall, floor plate, room, slab (px 1) -----
        sh = []
        sh.append(poly(P, [P2(0, D, z0), P2(W, D, z0), P2(W, D, z0 + H), P2(0, D, z0 + H)], U('wallB'), '#3a4f5a', 1.2))
        for wx in (5.0, 6.8, 8.6, 10.4):
            sh.append(path('M%s %s L%s %s' % (*P2(wx, D, z0 + .25), *P2(wx, D, z0 + H - .25)), '#38566a', 1.4, op=.5))
        sh.append(poly(P, [P2(0, D, z0 + 1.5), P2(W, D, z0 + 1.5), P2(W, D, z0 + 1.65), P2(0, D, z0 + 1.65)], '#9fc9d8', op=.07))
        sh.append(poly(P, [P2(0, 0, z0), P2(0, D, z0), P2(0, D, z0 + H), P2(0, 0, z0 + H)], U('wallL'), '#3a4f5a', 1.2))
        sh.append(poly(P, [P2(0, 0, z0), P2(W, 0, z0), P2(W, D, z0), P2(0, D, z0)], U('floorT')))
        sh.append(poly(P, [P2(3.2, .8, z0), P2(W, .8, z0), P2(W, 1.8, z0), P2(3.2, 1.8, z0)], '#566a75', op=.38))
        sh.append(path('M%s %s L%s %s' % (*P2(3.2, 1.3, z0), *P2(W, 1.3, z0)), '#9fb2ba', 1.2, dash='3 7', op=.45))
        sh.append(poly(P, [P2(0, 0, z0), P2(3.1, 0, z0), P2(3.1, D, z0), P2(0, D, z0)], '#0e1a20', op=.45))
        sh.append(path('M%s %s L%s %s' % (*P2(3.1, 0, z0), *P2(3.1, D, z0)), '#8fa4ad', 1.4, op=.5))
        sh.append(front(P, 0, 0, z0 - T, W, T, U('slabF'), None, 1, 1))
        sh.append(side(P, W, 0, z0 - T, D, T, '#35444b'))
        sh.append(path('M%s %s L%s %s' % (*P2(0, 0, z0), *P2(W, 0, z0)), '#ffffff', 1, op=.28))
        sc.add(sh, 1, frm, '', cls)
        # ----- riser column + firestop collar + feeder (stage 3; fiber + cabling) -----
        rx, ry, rs = 2.55, 1.7, .42
        run = []
        run.append(box(P, rx, ry, z0, rs, rs, H, '#0f1b21', '#1d2d35', '#0b1418', '#3a5360', 1.2))
        run.append(poly(P, [P2(rx - .1, ry - .1, z0), P2(rx + rs + .1, ry - .1, z0), P2(rx + rs + .1, ry + rs + .1, z0), P2(rx - .1, ry + rs + .1, z0)], '#8a5a3a', '#c98a5a', 1.1))
        sc.add(run, 2, 3, 'fiber cabling', cls)
        fa, fb = P2(rx + .13, ry + .08, z0 + .05), P2(rx + .13, ry + .08, z0 + H - .05)
        ca_, cb_ = P2(rx + .3, ry + .08, z0 + .05), P2(rx + .3, ry + .08, z0 + H - .05)
        sc.add([path('M%s %s L%s %s' % (*fa, *fb), '#0c161c', 6.6, extra='class="draw dl%d" pathLength="1"' % (fl + 1)),
                path('M%s %s L%s %s' % (*fa, *fb), CY, 3.4, extra='class="draw dl%d" pathLength="1"' % (fl + 1)),
                path('M%s %s L%s %s' % (*ca_, *cb_), '#0c161c', 5.6, extra='class="draw dl%d" pathLength="1"' % (fl + 1)),
                path('M%s %s L%s %s' % (*ca_, *cb_), CA, 2.8, extra='class="draw dl%d" pathLength="1"' % (fl + 1))], 2, 3, 'fiber cabling', cls)
        # ----- rack (MDF on the ground floor, IDF above) -----
        rf = rack_face(sc, fl, z0, 3 if up else 2, rh)
        if fl == 0:
            A['rack0face'] = rf['face']
            A['rack0top'] = P2(1.0, .9, rh)
        if fl == 0:
            # UPS beside the rack, splice point on the back wall, TGB bond
            ux, uy = P2(1.8, .55, .6)
            sc.add(box(P, 1.8, .55, 0, .5, .6, .75, '#22343d', '#33474f', '#17252c', '#5b6b73', 1.1, 2) + circ(ux + 6, uy + 5, 2, CG), 2, 2, 'cabling', 'unit u2')
            sc.add(box(P, 1.78, 2.18, 1.15, .6, .3, .55, '#17303b', '#274b5a', '#0e2029', CY, 1.2, 2), 2, 2, 'fiber', 'unit u3')
            tp = P2(.55, D, 1.0)
            tb = [rect(tp[0], tp[1], 1.0 * S, 6, CA, '#ffe2b0', .7, 1.5)] + [circ(tp[0] + 9 + k * 10.5, tp[1] + 3, 1.4, '#2a1b0a') for k in range(4)]
            sc.add(tb, 2, 2, 'cabling', 'unit u4')
            rt = P2(1.15, .95, rh)
            bond = 'M%s %s C%s %s %s %s %s %s' % (tp[0] + 14, tp[1] + 6, tp[0] + 8, tp[1] + 40, rt[0] + 10, rt[1] - 36, rt[0] + 10, rt[1] - 1)
            sc.add(path(bond, '#9bd36a', 2.6), 2, 2, 'cabling', 'unit u4')
            A['tgb'] = (tp[0] + 20, tp[1] + 3)
            A['ups'] = P2(2.05, .85, .7)
        # feeder from the rack to the corridor tray + riser tie
        fd = pl((1.1, 1.0, z0 + rh), (1.1, 1.0, z0 + TRAY), (2.75, 1.0, z0 + TRAY), (2.75, TRAY_Y, z0 + TRAY))
        sc.add(draw(fd, CY, 2.6, 2, False), 2, 3, 'fiber', cls)
        # ----- ceiling plane (translucent tile grid), stage 4 -----
        cp = [poly(P, [P2(3.1, 0, cz), P2(W, 0, cz), P2(W, D, cz), P2(3.1, D, cz)], '#bcdde8', '#7fa7b6', 1, op=.085)]
        for gx in range(4, 11):
            cp.append(path('M%s %s L%s %s' % (*P2(gx, 0, cz), *P2(gx, D, cz)), '#9cc2d1', .8, op=.2))
        for gy in (.65, 1.3, 1.95):
            cp.append(path('M%s %s L%s %s' % (*P2(3.1, gy, cz), *P2(W, gy, cz)), '#9cc2d1', .8, op=.2))
        sc.add(cp, 2, 4, '', 'peel')
        # ----- tray above the ceiling + J-hooks to outlets (stage 4, cabling) -----
        tr = []
        for yy in (TRAY_Y - .11, TRAY_Y + .11):
            tr.append(path('M%s %s L%s %s' % (*P2(2.75, yy, tz), *P2(10.7, yy, tz)), '#d6e2e8', 3.4, extra='class="draw dl1" pathLength="1"'))
        sc.add(tr, 2, 4, 'cabling')
        rungs = [path('M%s %s L%s %s' % (*P2(tx_, TRAY_Y - .11, tz), *P2(tx_, TRAY_Y + .11, tz)), '#7d909a', 1.2) for tx_ in [2.95 + i * .42 for i in range(19)]]
        sc.add(rungs, 2, 4, 'cabling', 'fade2')
        trunk = pl((2.75, TRAY_Y, tz + .06), (10.7, TRAY_Y, tz + .06))
        sc.add(draw(trunk, CA, 2.4, 2, False), 2, 4, 'cabling')
        for jx in JH_X:
            # branch off the tray to a J-hook, then a drop down the back wall to an outlet
            sc.add(path('M%s %s L%s %s' % (*P2(jx, TRAY_Y + .11, tz), *P2(jx, D - .08, tz)), '#c9d6dc', 2), 2, 4, 'cabling', 'fade2')
            hk = P2(jx, 2.25, tz)
            sc.add(path('M%s %s q0 -9 7 -9 q7 0 7 9' % (hk[0] - 7, hk[1]), '#c9d6dc', 2.2), 2, 4, 'cabling', 'fade2')
            dr = pl((jx, D - .08, tz), (jx, D - .08, z0 + .85))
            sc.add(draw(dr, CA, 1.8, 3, False), 2, 4, 'cabling')
            ox_, oy_ = P2(jx, D - .08, z0 + .85)
            sc.add(rect(ox_ - 6, oy_ - 1, 12, 9, CA, '#2a1b0a', .7, 1.5), 2, 4, 'cabling', 'fade2')
        # ----- access points in the ceiling grid + coverage ripple (stage 5, wireless) -----
        for k, ax in enumerate(AP_X):
            ap = P2(ax, AP_Y, cz)
            drop = pl((ax, TRAY_Y - .11, tz), (ax, AP_Y, tz), (ax, AP_Y, cz + .03))
            sc.add(draw(drop, CG, 1.8, 1, False), 2, 5, 'wireless')
            fp = P2(ax, AP_Y, z0 + .02)
            sc.add('<g clip-path="url(#%sfp%d)"><g transform="matrix(%s 0 %s %s %s %s)">%s%s</g></g>' % (
                ID, fl, f(S), f(P.dx * S), f(-P.dy * S), f(fp[0]), f(fp[1]),
                '<circle r="1.25" fill="%s" class="rip" opacity=".95"/>' % U('bloomG'),
                '<circle r="1.25" fill="none" stroke="%s" stroke-width="1.4" stroke-dasharray="4 5" vector-effect="non-scaling-stroke" class="rip rip2" opacity=".75"/>' % CG), 2, 5, 'wireless')
            sc.add(ell(ap[0], ap[1] + 1.5, 13, 5, '#0b161d', op=.6) + ell(ap[0], ap[1], 12, 4.8, U('apG'), CG, 1.8, extra='class="ap" filter="url(#%sgl)"' % ID), 2, 5, 'wireless', 'pop')
        # ----- cameras with view cones (stage 6, surveillance) -----
        if fl == 0:
            lens = P2(4.7, .15, z0 + 2.45)
            cone = 'M%s %s L%s %s L%s %s Z' % (*lens, *P2(3.2, 2.3, z0), *P2(6.4, 2.0, z0))
        else:
            lens = P2(10.8, 1.3, z0 + 2.3)
            cone = 'M%s %s L%s %s L%s %s Z' % (*lens, *P2(4.6, .75, z0), *P2(4.6, 1.85, z0))
        sc.add(path(cone, None, 1, fill=CP, op=.26, extra='class="cone"') + rect(lens[0] - 8, lens[1] - 5, 16, 10, '#2a2438', CP, 1.7, 3) + circ(lens[0] - 4, lens[1], 2.4, '#f0e6ff'), 2, 6, 'surveillance', 'pop')
        anchors[fl] = dict(lens=lens)
        # ----- door + reader on the latch-side jamb (stage 7, access) -----
        if fl == 0:
            dpx, dpy = P2(4.2, 0, z0 + 2.05)
            dw = 1.0
            sc.add(rect(dpx, dpy, dw * S, 2.05 * S, U('doorG'), CO, 1.9, 2) + rect(dpx + 6, dpy + 6, dw * S - 12, 2.05 * S - 6, '#9fc9d8', None, 0, 1, op=.12), 2, 2, '', 'door')
            rdx, rdy = dpx + dw * S + 5, dpy + 1.15 * S
            rd = pl((5.45, 0, z0 + 1.15), (5.45, 0, tz - .05), (1.65, 0, tz - .05), (1.65, 1.0, tz - .05), (1.65, 1.0, z0 + rh))
        else:
            dpx, dpy = P2(3.5, D, z0 + 2.05)
            dw = 1.0
            sc.add(rect(dpx, dpy, dw * S, 2.05 * S, U('doorG'), CO, 1.9, 2) + rect(dpx + 6, dpy + 6, dw * S - 12, 2.05 * S - 6, '#9fc9d8', None, 0, 1, op=.12), 1, frm, '', cls)
            rdx, rdy = dpx + dw * S + 5, dpy + 1.15 * S
            rd = pl((4.65, D, z0 + 1.15), (4.65, D, tz - .05), (1.65, D, tz - .05), (1.65, 1.0, tz - .05), (1.65, 1.0, z0 + rh))
        sc.add(rect(rdx, rdy, 6, 15, CO, '#ffd1ba', .8, 1.5, extra='class="reader" filter="url(#%sgl)"' % ID), 2, 7, 'access', 'pop')
        sc.add(draw(rd, CO, 1.8, 2, False), 2, 7, 'access')
        A['reader%d' % fl] = (rdx + 3, rdy + 7)
        A['rack%d' % fl] = P2(1.0, .5, z0 + rh * .55)
        A['ceil%d' % fl] = P2(AP_X[1], AP_Y, cz)
        A['cam%d' % fl] = lens
    A['ap1'] = P2(AP_X[1], AP_Y, zs[1] + CEIL)
    A['ap2'] = P2(AP_X[1], AP_Y, zs[2] + CEIL)
    A['riser'] = P2(2.76, 1.9, 2 * H + .9)
    A['jh'] = P2(JH_X[1], 2.25, 2 * H + TRAY)
    A['tray'] = P2(8.0, TRAY_Y, 2 * H + TRAY)
    # ---------- parking camera on a pole (stage 6, px 2) ----------
    px_, py_ = P2(W + .6, -.85, 0)
    lens = P2(W + .6, -.85, 3.0)
    pole = [ell(px_, py_ + 2, 10, 3.6, '#000', op=.5), path('M%s %s L%s %s' % (px_, py_, lens[0], lens[1] + 4), '#9fb2ba', 3.4)]
    cone = 'M%s %s L%s %s L%s %s Z' % (*lens, *P2(7.2, -1.35, 0), *P2(8.6, -.2, 0))
    sc.add(pole + [path(cone, None, 1, fill=CP, op=.26, extra='class="cone"'), rect(lens[0] - 9, lens[1] - 5, 17, 10, '#2a2438', CP, 1.7, 3), circ(lens[0] - 5, lens[1], 2.4, '#f0e6ff')], 2, 6, 'surveillance', 'pop')
    A['park'] = lens
    # ---------- facade (stage 1 only) + roof ----------
    fc = []
    fc.append(poly(P, [P2(-.05, 0, 0), P2(W + .05, 0, 0), P2(W + .05, 0, 3 * H), P2(-.05, 0, 3 * H)], U('glass'), '#4a6a7a', 1.4, .98))
    for gx in [x * W / 6 for x in range(1, 6)]:
        fc.append(path('M%s %s L%s %s' % (*P2(gx, 0, 0), *P2(gx, 0, 3 * H)), '#38566a', 2))
    for z in (H, 2 * H):
        fc.append(path('M%s %s L%s %s' % (*P2(0, 0, z), *P2(W, 0, z)), '#38566a', 2))
    fc.append(poly(P, [P2(W, 0, 0), P2(W, D, 0), P2(W, D, 3 * H), P2(W, 0, 3 * H)], '#17303b', '#4a6a7a', 1.2, .98))
    fc.append(front(P, 4.2, 0, 0, 1.0, 2.05, '#0b161d', CY, 1.8, 2))
    sc.add(fc, 1, 0, '', 'facade')
    sc.add(poly(P, [P2(-.2, -.15, 3 * H), P2(W + .2, -.15, 3 * H), P2(W + .2, D + .15, 3 * H), P2(-.2, D + .15, 3 * H)], '#2e3f48', '#8fa4ad', 1.4, .96)
           + front(P, -.2, -.15, 3 * H - .2, W + .4, .2, '#6a7b83', None, 1, 1), 1, 0, '', 'roof')
    # ghost of the right glass wall and roof outline once the roof is away
    sc.add(side(P, W, 0, 0, D, 3 * H, '#9fc9d8', '#7fa7b6', 1, .05), 1, 3, '', 'up')
    sc.add(poly(P, [P2(-.2, -.15, 3 * H), P2(W + .2, -.15, 3 * H), P2(W + .2, D + .15, 3 * H), P2(-.2, D + .15, 3 * H)], 'none', '#8fa4ad', 1.4, .5, extra='stroke-dasharray="6 6"'), 1, 3, '', 'up')
    return sc, A


def labels(A):
    lb = Labels(VB, FS_W, FS_N)
    L = lb.add
    # Only the approved nouns. Each callout lists the steps and picked systems it shows on; positions are
    # placed in the empty part of the frame for those steps and verified in code (Labels.check).
    rk = A['rack0']
    top = A['rack0top']
    fx, fy = A['rack0face']
    L('mdf1', 'MDF', rk, (200, 556), steps=(1, 8), focus=('fiber', 'cabling'))
    L('mdf2', 'MDF', top, (96, 290), steps=(2,))
    L('fe2', 'Fiber enclosure', (fx + 30, fy + 14), (250, 322), steps=(2,), focus=('fiber',))
    L('sw2', 'Switch', (fx + 30, fy + 68), (270, 412), steps=(2,))
    L('riser3', 'Riser', A['riser'], (330, 110), steps=(3,))
    L('riser8', 'Riser', A['riser'], (170, 64), steps=(8,), focus=('fiber',))
    L('idf3', 'IDF', A['rack1'], (165, 262), steps=(3, 7), focus=('cabling', 'access'))
    L('jh4', 'J-hooks off tray', A['jh'], (470, 128), steps=(4,), focus=('cabling',))
    L('ap5', 'AP in ceiling', A['ap2'], (520, 150), steps=(5, 8), focus=('wireless',))
    L('cc6', 'Corridor camera', A['cam1'], (520, 300), steps=(6,), focus=('surveillance',))
    L('ec6', 'Entry camera', A['cam0'], (300, 556), steps=(6,), focus=('surveillance',))
    L('pc6', 'Parking camera', A['park'], (520, 556), steps=(6,), focus=('surveillance',))
    L('rdr7', 'Reader, latch-side jamb', A['reader0'], (330, 556), steps=(7,), focus=('access',))
    return lb


GROUPS = {
    **{'step%d' % s: [] for s in range(1, 9)},
}


def groups(lb):
    g = {}
    for s in range(1, 9):
        g['step%d' % s] = [i['key'] for i in lb.items if s in i['steps']]
    for fsys in ('fiber', 'cabling', 'wireless', 'surveillance', 'access'):
        g['focus-' + fsys] = [i['key'] for i in lb.items if fsys in i['focus']]
    return g


TAG = '(illustrative)'


def tag_svg(A, mode, only=None):
    """The "(illustrative)" tag printed on the coverage ripple, at both label sizes. Bare text, no pill."""
    ap = P2(AP_X[1], AP_Y, .02)
    out = []
    for var, fs in (('w', FS_W), ('n', FS_N)):
        if only and var != only:
            continue
        cx, cy = ap[0], ap[1] + 18
        t = text(cx, cy, TAG, fs, '#d9ffe6', 'middle', 700, 'stroke="#06100c" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"')
        out.append(t if mode == 'still' else '<g class="tg tg-%s">%s</g>' % (var, t))
    return out if mode != 'still' else ''.join(out)


def tag_box(A, var):
    fs = FS_W if var == 'w' else FS_N
    ap = P2(AP_X[1], AP_Y, .02)
    w = len(TAG) * fs * .6
    return (ap[0] - w / 2, ap[1] + 18 - fs, w, fs * 1.3)


def svg(mode='player', narrow=False, labels_for=None, ids=('bld-title', 'bld-desc')):
    """mode 'player': layered, class-driven (stage.css). mode 'still': flat, everything on, presentation attributes only."""
    sc, A = build()
    lb = labels(A)
    rep = lb.check(groups(lb))
    v = 'n' if narrow else 'w'
    vb = VB[v]
    o = []
    attrs_ = ('class="bld-svg bld" data-art data-vb-w="%d %d %d %d" data-vb-n="%d %d %d %d" ' % (VB['w'] + VB['n']) if mode == 'player' else '')
    o.append('<svg %sviewBox="%d %d %d %d" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="%s %s" focusable="false" preserveAspectRatio="xMidYMid meet">' % (
        attrs_, *(vb if mode == 'still' else VB['w']), *ids))
    o.append('<title id="%s">Cutaway of a generic three-story commercial building</title>' % ids[0])
    o.append('<desc id="%s">Layered 2.5D cutaway built in eight stages. OSP fiber enters from a street handhole, runs up a floor sleeve into the MDF rack, a riser climbs to an IDF stacked on each floor, a tray above the ceiling carries J-hooks to outlets, ceiling access points show an illustrative coverage ripple, cameras look inward from the entry, corridors and parking, and readers sit on the latch-side jamb.</desc>' % ids[1])
    o.append(defs())
    o.append(sc.render(mode))
    if mode == 'player':
        o.append('<g class="tags">%s</g>' % '\n'.join(tag_svg(A, mode)))
        o.append(lb.render(mode))
    else:
        o.append(tag_svg(A, mode, only=v))
        o.append(lb.render(mode, only=[i['key'] for i in lb.items if 8 in i['steps']], var_only=v))
    o.append('</svg>')
    return '\n'.join(o), rep


if __name__ == '__main__':
    s, rep = svg('player')
    print(s)
