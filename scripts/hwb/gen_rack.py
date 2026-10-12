"""How We Build, Data Center Rack tab: layered 30-degree oblique 2.5D view of a generic 42U four-post rack.

LIGHT-501 drew step 6; LIGHT-503 splits it into the six steps of the approved copy (LIGHT-455) so each step
visibly adds its own parts, and gives the overhead ladder rack real perspective depth (side rails with height,
rungs between them) instead of a flat bar. Output is pure SVG: presentation attributes only, no style="".
"""
import sys
from lib25 import *

S, OX, OY = 53, 100, 640
P = Proj(S, OX, OY, k=0.6)
CY, CA, CG, CP, CO = '#53c3df', '#e0a85a', '#7fe3a0', '#c79bff', '#ff9a6b'
RW, RD = 4.5, 2.2          # rack outer width, depth
VM = .75                   # vertical manager width
ZB, ZT = .55, 7.9          # rack bottom / top
BW = 2.9                   # back wall depth
VB = {'w': (0, 0, 480, 680), 'n': (0, 55, 480, 600)}
FS_W, FS_N = 13, 16
ID = 'r-'
TAG = '(illustrative)'


def U(n):
    return 'url(#%s%s)' % (ID, n)


def P2(x, y, z):
    return P.p(x, y, z)


def defs():
    A = lambda n: ID + n
    d = []
    d.append(lin(A('bg'), [(0, '#16252d'), (1, '#0a1116')], .5, 0, .5, 1))
    d.append(rad(A('glowBg'), [(0, '#2b5a6e', .42), (1, '#2b5a6e', 0)]))
    d.append(lin(A('wallG'), [(0, '#24353e'), (1, '#16222a')]))
    d.append(lin(A('floorG'), [(0, '#33464f'), (1, '#1f2e36')]))
    d.append(lin(A('post'), [(0, '#53656e'), (1, '#2c3a42')], 0, 0, 1, 0))
    d.append(lin(A('devF'), [(0, '#2c3d46'), (1, '#1a252c')]))
    d.append(lin(A('devT'), [(0, '#4a5f69'), (1, '#33454e')]))
    d.append(lin(A('devS'), [(0, '#1d2a31'), (1, '#10181d')], 0, 0, 1, 0))
    d.append(lin(A('feF'), [(0, '#1f3f4c'), (1, '#142a33')]))
    d.append(lin(A('vm'), [(0, '#1d2b33'), (1, '#131d23')], 0, 0, 1, 0))
    d.append(lin(A('screen'), [(0, '#10222b'), (1, '#0a161c')]))
    d.append(lin(A('sideGlass'), [(0, '#7fb6c9', .16), (1, '#7fb6c9', .05)], 0, 0, 1, 0))
    d.append(lin(A('rail'), [(0, '#e6eef1'), (1, '#9fb2ba')]))
    d.append('<filter id="%ssh" x="-30%%" y="-30%%" width="160%%" height="170%%"><feGaussianBlur stdDeviation="8"/></filter>' % ID)
    d.append('<filter id="%sgl" x="-30%%" y="-30%%" width="160%%" height="160%%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' % ID)
    d.append('<filter id="%sgl2" x="-60%%" y="-60%%" width="220%%" height="220%%"><feGaussianBlur stdDeviation="3.4"/></filter>' % ID)
    return '<defs>%s</defs>' % ''.join(d)


def build():
    sc = Scene()
    A = {}
    # ================= room (px 0) =================
    sc.add(rect(-200, -200, 880, 1100, U('bg')), 0)
    sc.add(ell(250, 330, 280, 300, U('glowBg')), 0)
    wx0, wx1 = -4.4, 7.0
    sc.add(poly(P, [P2(wx0, BW, 0), P2(wx1, BW, 0), P2(wx1, BW, 13), P2(wx0, BW, 13)], U('wallG')), 0)
    for gx in [-3.2, -1.1, 1.9, 4.9]:
        sc.add(path('M%s %s L%s %s' % (*P2(gx, BW, 0), *P2(gx, BW, 13)), '#3a4f5a', 1, op=.45), 0)
    sc.add(path('M%s %s L%s %s' % (*P2(wx0, BW, 5.6), *P2(wx1, BW, 5.6)), '#3a4f5a', 1, op=.3), 0)
    sc.add(poly(P, [P2(wx0, 0, 0), P2(wx1, 0, 0), P2(wx1, BW, 0), P2(wx0, BW, 0)], U('floorG')), 0)
    for gx in range(-2, 7):
        sc.add(path('M%s %s L%s %s' % (*P2(gx, 0, 0), *P2(gx, BW, 0)), '#4a5f69', 1, op=.35), 0)
    for gy in [.7, 1.4, 2.1]:
        sc.add(path('M%s %s L%s %s' % (*P2(wx0, gy, 0), *P2(wx1, gy, 0)), '#4a5f69', 1, op=.3), 0)
    sc.add(front(P, wx0, 0, -.28, wx1 - wx0, .28, '#46565e', None, 0, 0), 0)
    sc.add(path('M%s %s L%s %s' % (*P2(wx0, 0, 0), *P2(wx1, 0, 0)), '#ffffff', 1, op=.25), 0)
    sc.add(poly(P, [P2(.1, -.15, 0), P2(RW + .8, -.15, 0), P2(RW + 1.6, RD + .5, 0), P2(.6, RD + .5, 0)], '#000', op=.6, extra='filter="url(#%ssh)"' % ID), 0)
    sc.add(poly(P, [P2(-.2, BW, 1.0), P2(RW + .5, BW, 1.0), P2(RW + .3, BW, 9.4), P2(-.2, BW, 9.4)], '#000', op=.22, extra='filter="url(#%ssh)"' % ID), 0)

    # ================= step 1: busbar, bond, empty rack, ladder rack =================
    tg = P2(-3.0, BW, 1.1)
    bb = [rect(tg[0], tg[1], 1.6 * S, 7, CA, '#ffe2b0', .8, 2)]
    for k_ in range(6):
        bb.append(circ(tg[0] + 9 + k_ * 12, tg[1] + 3.5, 1.4, '#2a1b0a'))
    bb.append(rect(tg[0] - 2, tg[1] + 7, 5, 8, '#6b4a1f', None, 0, 1))
    bb.append(rect(tg[0] + 1.6 * S - 3, tg[1] + 7, 5, 8, '#6b4a1f', None, 0, 1))
    sc.add(bb, 0, 1, '', 'fade')
    rp = P2(0.04, 0, ZB + .62)
    bond = 'M%s %s C%s %s %s %s %s %s' % (tg[0] + 1.6 * S - 4, tg[1] + 12, tg[0] + 1.6 * S + 30, tg[1] + 60, rp[0] - 50, rp[1] + 10, rp[0], rp[1])
    sc.add([path(bond, '#0c161c', 5, extra='class="draw" pathLength="1"'), path(bond, '#9bd36a', 3, extra='class="draw" pathLength="1"')], 1, 1, '')
    sc.add(rect(rp[0] - 4, rp[1] - 5, 9, 10, '#9bd36a', '#2a3b17', .8, 2), 1, 1, '', 'fade2')
    A['tgb'] = (tg[0] + 1.6 * S - 4, tg[1] + 12)
    A['tgbpill'] = (tg[0] + .8 * S, tg[1] + 3)

    # rack frame: side glass, back posts, base, well, posts, top, base frames
    fr = []
    fr.append(side(P, RW, 0, ZB, RD, ZT - ZB, U('sideGlass'), '#7fb6c9', 1))
    for (px_, py_) in [(0, RD), (RW, RD)]:
        fr.append(path('M%s %s L%s %s' % (*P2(px_, py_, ZB), *P2(px_, py_, ZT)), '#3a4b54', 3.5, op=.85))
    fr.append(poly(P, [P2(0, 0, ZB), P2(RW, 0, ZB), P2(RW, RD, ZB), P2(0, RD, ZB)], '#101a20', '#3a5360', 1.2))
    fr.append(front(P, VM, 0, ZB, RW - 2 * VM, ZT - ZB, '#06090c', None, 0, 0))
    for pxx in (VM - .16, RW - VM):
        fr.append(front(P, pxx, 0, ZB, .16, ZT - ZB, U('post'), '#6a7b83', .8, 1))
        hp = P2(pxx + .08, 0, ZB + .08)
        fr.append(path('M%s %s L%s %s' % (hp[0], hp[1], hp[0], hp[1] - (ZT - ZB - .16) * S), '#05090c', 2.6, dash='.1 5.2'))
    fr.append(top(P, 0, 0, ZT, RW, RD, U('devT'), '#6a7b83', 1))
    fr.append(front(P, 0, 0, ZT - .22, RW, .22, U('post'), '#7a8b93', 1, 2))
    fr.append(front(P, 0, 0, ZB, RW, .22, U('post'), '#7a8b93', 1, 2))
    sc.add(fr, 1, 1, '', 'fade')

    # overhead ladder rack, with perspective depth: two side rails (box faces) + rungs, hangers to the ceiling
    lz, ly0, ly1 = 8.75, .3, 2.0
    lx0, lx1 = -.9, RW + .9
    lad = []
    for hx in (-.4, RW + .4):
        lad.append(path('M%s %s L%s %s' % (*P2(hx, (ly0 + ly1) / 2, lz + .3), *P2(hx, (ly0 + ly1) / 2, 10.6)), '#6a7b83', 2.4))
    lad.append(path('M%s %s L%s %s' % (*P2(RW / 2, (ly0 + ly1) / 2, lz), *P2(RW / 2, (ly0 + ly1) / 2, ZT + .12)), '#6a7b83', 2.4))
    nr = 16
    for i in range(nr + 1):
        xx = lx0 + .05 + i * (lx1 - lx0 - .1) / nr
        lad.append(top(P, xx - .06, ly0 + .1, lz + .1, .12, ly1 - ly0 - .1, '#c9d6dc', '#74868f', .6))
    # far rail first (behind the rungs), near rail last
    lad.append(box(P, lx0, ly1 - .1, lz, lx1 - lx0, .1, .2, U('rail'), '#f2f6f8', '#74868f', '#4d5d65', .7, 1))
    lad.append(box(P, lx0, ly0, lz, lx1 - lx0, .1, .2, U('rail'), '#f2f6f8', '#74868f', '#4d5d65', .7, 1))
    sc.add(lad, 2, 1, '', 'fade')
    A['lad'] = P2(3.6, ly0 + .05, lz + .15)

    # ================= devices, top to bottom (px 1) =================
    x0, x1 = VM, RW - VM
    wdev = x1 - x0
    zc = ZT - .3
    slots = {}

    def dev_geom(h):
        nonlocal zc
        zc -= h
        return zc

    # --- fiber enclosure (step 3) ---
    h = .52
    z_ = dev_geom(h)
    fe_z = z_
    fe = [top(P, x0, 0, z_ + h, wdev, .25, U('devT'), None, 0) + front(P, x0, 0, z_, wdev, h, U('feF'), CY, 1.1, 2)]
    for i in range(6):
        px_, py_ = P2(x0 + .1 + i * (wdev - .2) / 6, 0, z_ + .46)
        fe.append(rect(px_, py_, (wdev - .2) / 6 * S - 3, .4 * S, '#0a1a21', CY, .9, 2, op=.95))
        fe.append(circ(px_ + 7, py_ + 8, 1.7, CY))
        fe.append(circ(px_ + 15, py_ + 8, 1.7, CY))
    sc.add(fe, 1, 3, 'fiber cabling', 'unit u1')
    zc -= .06

    def hman_svg():
        nonlocal zc
        zc -= .17
        px_, py_ = P2(x0, 0, zc + .17)
        out = rect(px_, py_, wdev * S, .17 * S, '#16222a', '#4a5a62', .8, 1)
        for i in range(16):
            out += rect(px_ + 6 + i * (wdev * S - 12) / 16, py_ + 3, 1.6, .17 * S - 6, '#4a5a62', None, 0, 0)
        return out

    cp_z, sw_z = [], []
    hms = []
    for i in range(3):
        hms.append(hman_svg())
        h = .34
        z_ = dev_geom(h)
        cp_z.append(z_)
        px_, py_ = P2(x0, 0, z_ + h)
        cp = [top(P, x0, 0, z_ + h, wdev, .25, U('devT'), None, 0) + front(P, x0, 0, z_, wdev, h, U('devF'), '#5b6b73', 1.1, 2)]
        for j in range(24):
            xx = px_ + 6 + j * (wdev * S - 12) / 24
            cp.append(rect(xx, py_ + 11, 4.6, 6, '#050a0d', CA, .6, 0))
            if j % 6 == 0:
                cp.append(rect(xx - .5, py_ + 3, 3.2, 3.2, '#dff5ff', None, 0, 0))
        sc.add(cp, 1, 3, 'cabling', 'unit u%d' % (i + 2))
    hms.append(hman_svg())
    for i in range(2):
        h = .3
        z_ = dev_geom(h)
        sw_z.append(z_)
        px_, py_ = P2(x0, 0, z_ + h)
        sw = [top(P, x0, 0, z_ + h, wdev, .25, U('devT'), None, 0) + front(P, x0, 0, z_, wdev, h, U('devF'), '#5b6b73', 1.1, 2)]
        leds = []
        for j in range(24):
            xx = px_ + 6 + j * (wdev * S - 12) / 24
            sw.append(rect(xx, py_ + 12, 4.6, 5, '#050a0d', None, 0, 0))
            leds.append(circ(xx + 2.3, py_ + 8, 1.2, CG if (j + i) % 5 else '#ffd36a'))
        sw.append(rect(px_ + wdev * S - 34, py_ + 5, 26, 4, '#1a2831', '#4a5a62', .5, 1))
        sc.add(sw, 1, 4, 'cabling', 'unit u%d' % (i + 1))
        sc.add('<g class="led">%s</g>' % ''.join(leds), 1, 4, 'cabling', 'unit u%d' % (i + 1))
    zc -= .06
    hms.append(hman_svg())
    # horizontal managers belong to step 2
    sc.add(hms, 1, 2, '', 'unit u1')

    # --- splice tray (step 6) ---
    sp_h = .98
    zc -= sp_h
    sp_z = zc
    sx, sy = P2(x0, 0, zc + sp_h)
    scy = sy + sp_h * S / 2
    mid = sx + wdev * S / 2
    spl = [top(P, x0, 0, zc + sp_h, wdev, .3, U('devT'), None, 0) + front(P, x0, 0, zc, wdev, sp_h, U('feF'), CY, 1.3, 4)]
    spl.append(path('M%s %s H%s' % (sx + 14, scy, sx + 60), CY, 3))
    spl.append(path('M%s %s H%s' % (sx + wdev * S - 60, scy, sx + wdev * S - 14), CY, 3))
    spl.append(path('M%s %s C%s %s %s %s %s %s' % (sx + 14, scy, sx + 14, scy - 26, sx + 46, scy - 26, sx + 46, scy), CY, 2, op=.7))
    spl.append(path('M%s %s C%s %s %s %s %s %s' % (sx + wdev * S - 46, scy, sx + wdev * S - 46, scy + 26, sx + wdev * S - 14, scy + 26, sx + wdev * S - 14, scy), CY, 2, op=.7))
    spl.append(rect(mid - 36, scy - 4, 28, 8, '#d9c9ff', '#8d70d6', 1, 4))
    spl.append(rect(mid + 8, scy - 4, 28, 8, '#d9c9ff', '#8d70d6', 1, 4))
    sc.add(spl, 1, 6, 'fiber', 'unit u1')
    zc -= .16
    sc.add([ell(mid, scy, 20, 20, '#fff6c9', op=.28, extra='filter="url(#%sgl2)"' % ID),
            path('M%s %s l5 -14 l4 11 l11 -4 l-9 9 l9 8 l-12 -2 l-3 12 l-5 -12 l-12 3 l9 -9 l-9 -8 l12 3z' % (mid - 4, scy), '#ffd36a', 1, fill='#fff6c9')], 1, 6, 'fiber', 'flash')

    # --- test-trace drawer / screen (step 6) ---
    tr_h = 1.95
    zc -= tr_h
    tr_z = zc
    tx, ty = P2(x0 + .16, 0, zc + tr_h - .14)
    tw, th = (wdev - .32) * S, (tr_h - .3) * S
    trd = [top(P, x0, 0, zc + tr_h, wdev, .3, U('devT'), None, 0) + front(P, x0, 0, zc, wdev, tr_h, U('devF'), '#5b6b73', 1.2, 4),
           rect(tx, ty, tw, th, U('screen'), '#3a5360', 1.2, 4),
           path('M%s %s V%s H%s' % (tx + 12, ty + 14, ty + th - 40, tx + tw - 12), '#4a5a62', 1.4)]
    sc.add(trd, 1, 6, 'fiber', 'unit u2')
    trc = 'M%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s' % (
        tx + 18, ty + 14, tx + tw * .30, ty + 16, tx + tw * .34, ty + 32, tx + tw * .38, ty + 18,
        tx + tw * .62, ty + 20, tx + tw * .66, ty + 34, tx + tw * .70, ty + 22, tx + tw - 16, ty + 24)
    sc.add([path(trc, CG, 3.4, op=.35, extra='class="draw dl2" pathLength="1"'), path(trc, CG, 2.6, extra='class="draw dl2" pathLength="1"')], 1, 6, 'fiber')
    pw = 100
    ok = [rect(tx + tw / 2 - pw / 2, ty + th - 28, pw, 22, '#143327', CG, 1.2, 11),
          path('M%s %s l5 5 l9 -10' % (tx + tw / 2 - pw / 2 + 12, ty + th - 17), CG, 2.6),
          rect(tx + tw / 2 - 18, ty + th - 22, 52, 3.4, CG, None, 0, 1.7, op=.8),
          rect(tx + tw / 2 - 18, ty + th - 15, 34, 3.4, CG, None, 0, 1.7, op=.5)]
    sc.add(ok, 1, 6, 'fiber', 'fade3')
    A['tag'] = (tx + tw / 2, ty + 51)            # "(illustrative)" sits on the trace screen
    A['tracebox'] = (tx, ty, tw, th)
    for i in range(3):
        zc -= .2
        if zc > ZB + .26:
            bp = P2(x0, 0, zc + .17)
            sc.add(rect(bp[0], bp[1], wdev * S, .17 * S, '#10191e', '#33444d', .8, 1), 1, 2, '', 'unit u1')

    # ================= vertical managers (step 2) =================
    def vman(x0_):
        out = front(P, x0_, 0, ZB + .22, VM, ZT - ZB - .44, U('vm'), '#4a6270', 1.1, 2)
        n = int((ZT - ZB - .44) / .26)
        for i in range(n):
            zz = ZB + .3 + i * .26
            p0 = P2(x0_ + .1, 0, zz)
            out += path('M%s %s L%s %s' % (p0[0], p0[1], p0[0] + (VM - .2) * S, p0[1]), '#566d79', 1.6, op=.9)
        return out
    sc.add(vman(0), 1, 2, '', 'vml')
    sc.add(vman(RW - VM), 1, 2, '', 'vmr')

    # ================= fiber trunk: ladder rack -> enclosure right edge (step 6) =================
    ent = P2(x1 - .02, 0, fe_z + .3)
    top_ = P2(RW - .5, (ly0 + ly1) / 2, lz + .02)
    mid_ = P2(RW - .5, 0, lz - .45)
    trunk = 'M%s %s C%s %s %s %s %s %s L%s %s' % (top_[0], top_[1], top_[0], top_[1] + 30, mid_[0] + 6, mid_[1] - 20, mid_[0] - 4, mid_[1] + 20, ent[0], ent[1])
    sc.add([path(trunk, CY, 9, op=.26, extra='class="draw" pathLength="1"'), path(trunk, '#0c161c', 7, extra='class="draw" pathLength="1"'),
            path(trunk, CY, 4.2, extra='class="draw" pathLength="1" filter="url(#%sgl)"' % ID), path(trunk, '#b9eefb', 1.2, op=.55, extra='class="draw" pathLength="1"')], 2, 6, 'fiber')
    A['trunk'] = (top_[0] + 6, top_[1] + 22)
    A['fe'] = P2(x1 - .5, 0, fe_z + .22)
    A['cp'] = P2(x1 - .4, 0, cp_z[1] + .17)
    A['sw'] = P2(x1 - .5, 0, sw_z[0] + .15)
    A['spl'] = P2(x1 - .3, 0, sp_z + .5)

    # ================= dressed bundles on the left (step 5) =================
    def pz(z_, h):
        return P2(x0, 0, z_ + h / 2)[1]
    cords = [
        (cp_z[0], .34, sw_z[0], .3, '#6ab8ff', 0),
        (cp_z[0], .34, sw_z[1], .3, '#ffd36a', 1),
        (cp_z[1], .34, sw_z[0], .3, '#b8f0c8', 2),
        (cp_z[2], .34, sw_z[1], .3, '#ff9a6b', 3),
        (cp_z[1], .34, sw_z[1], .3, '#c79bff', 4),
    ]
    for (za, ha, zb, hb, col, k_) in cords:
        ya, yb = pz(za, ha), pz(zb, hb)
        xa = P2(x0 + .12 + k_ * .1, 0, 0)[0]
        xl = P2(.18 + k_ * .09, 0, 0)[0]
        d_ = 'M%s %s C%s %s %s %s %s %s S%s %s %s %s' % (xa, ya, xa - 20, ya, xl, ya + 16, xl, (ya + yb) / 2, xa - 20, yb, xa, yb)
        sc.add([path(d_, '#0c161c', 4.6, op=.8, extra='class="draw dl%d" pathLength="1"' % (k_ % 3)), path(d_, col, 3, extra='class="draw dl%d" pathLength="1"' % (k_ % 3))], 1, 5, 'cabling')
    ys = sorted([pz(cp_z[0], .34), pz(cp_z[1], .34), pz(cp_z[2], .34), pz(sw_z[0], .3), pz(sw_z[1], .3)])
    wraps = []
    for k_, yw in enumerate([ys[0] + 16, ys[1] + 18, ys[2] + 16, ys[3] + 12]):
        bxl = P2(.14, 0, 0)[0]
        sc.add(rect(bxl, yw, 30, 5.5, CA, '#2a1b0a', .7, 1.5) + rect(bxl + 24, yw - 3.5, 6, 6, '#f1c98a', '#2a1b0a', .5, 1), 1, 5, 'cabling', 'wrap dw%d' % (k_ + 2))
        wraps.append((bxl, yw))
    tags = []
    for k_, yw in enumerate([ys[0] - 3, ys[2] - 3, ys[4] - 4]):
        tx_ = P2(x0, 0, 0)[0] - 15
        sc.add(rect(tx_, yw, 13, 7, '#f2f6f8', '#1b252b', .6, 1), 1, 5, 'cabling', 'fade3')
        tags.append((tx_, yw))
    A['wrap'] = (wraps[1][0] + 14, wraps[1][1] + 3)
    A['tags'] = (tags[1][0] + 6, tags[1][1] + 3)
    return sc, A


def labels(A):
    lb = Labels(VB, FS_W, FS_N)
    L = lb.add
    L('tgb1', 'TGB bond', A['tgb'], (96, 612), steps=(1,))
    L('fe3', 'Fiber enclosure', A['fe'], (402, 170), steps=(3,), narrow_pos=(384, 170))
    L('cp3', 'Copper patch panel', A['cp'], (390, 262), steps=(3,), narrow_pos=(380, 262))
    L('sw4', 'Switch', A['sw'], (420, 330), steps=(4,), narrow_pos=(420, 330))
    L('wrp5', 'Hook-and-loop wraps', A['wrap'], (150, 200), steps=(5,), narrow_pos=(150, 200))
    L('tag5', 'Label tags', A['tags'], (62, 430), steps=(5,), narrow_pos=(62, 430))
    L('trk6', 'Fiber trunk', A['trunk'], (420, 120), steps=(6,), narrow_pos=(400, 120))
    L('spl6', 'Splice tray', A['spl'], (400, 420), steps=(6,), narrow_pos=(380, 420))
    return lb


def groups(lb):
    return {'step%d' % s: [i['key'] for i in lb.items if s in i['steps']] for s in range(1, 7)}


def tag_svg(A, mode, only=None):
    out = []
    for var, fs in (('w', FS_W), ('n', FS_N)):
        if only and var != only:
            continue
        cx, cy = A['tag']
        t = text(cx, cy, TAG, fs, '#d9ffe6', 'middle', 700, 'stroke="#06100c" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"')
        out.append(t if mode == 'still' else '<g class="tg tg-%s">%s</g>' % (var, t))
    return out if mode != 'still' else ''.join(out)


def svg(mode='player', narrow=False, ids=('rack-title', 'rack-desc')):
    sc, A = build()
    lb = labels(A)
    rep = lb.check(groups(lb))
    v = 'n' if narrow else 'w'
    vb = VB[v]
    attrs_ = ('class="rack-svg rack" data-art data-vb-w="%d %d %d %d" data-vb-n="%d %d %d %d" ' % (VB['w'] + VB['n']) if mode == 'player' else '')
    o = ['<svg %sviewBox="%d %d %d %d" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="%s %s" focusable="false" preserveAspectRatio="xMidYMid meet">' % (
        attrs_, *(vb if mode == 'still' else VB['w']), *ids)]
    o.append('<title id="%s">Front view of a generic 42U four-post rack</title>' % ids[0])
    o.append('<desc id="%s">Layered 2.5D view of an unbranded rack under an overhead ladder rack, bonded to the wall grounding busbar. Built in six steps: empty rack, cable managers, patch panels and a fiber enclosure, switches, dressed bundles with hook-and-loop wraps and label tags, then the fiber trunk, splice tray and an illustrative test trace.</desc>' % ids[1])
    o.append(defs())
    o.append(sc.render(mode))
    if mode == 'player':
        o.append('<g class="tags">%s</g>' % '\n'.join(tag_svg(A, mode)))
        o.append(lb.render(mode))
    else:
        o.append(tag_svg(A, mode, only=v))
        o.append(lb.render(mode, only=[i['key'] for i in lb.items if 6 in i['steps']], var_only=v))
    o.append('</svg>')
    return '\n'.join(o), rep


if __name__ == '__main__':
    print(svg('player')[0])
