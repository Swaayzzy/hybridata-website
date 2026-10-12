import sys
from lib25 import *

S, OX, OY = 53, 100, 640
P = Proj(S, OX, OY, k=0.6)
CY, CA, CG, CP, CO = '#53c3df', '#e0a85a', '#7fe3a0', '#c79bff', '#ff9a6b'
RW, RD = 4.5, 2.2          # rack outer width, depth
VM = .75                   # vertical manager width
ZB, ZT = .55, 7.9          # rack bottom / top
BW = 2.9                   # back wall depth

def P2(x, y, z):
    return P.p(x, y, z)

def defs():
    d = []
    d.append(lin('bg', [(0, '#16252d'), (1, '#0a1116')], .5, 0, .5, 1))
    d.append(rad('glowBg', [(0, '#2b5a6e', .42), (1, '#2b5a6e', 0)]))
    d.append(lin('wallG', [(0, '#24353e'), (1, '#16222a')]))
    d.append(lin('floorG', [(0, '#33464f'), (1, '#1f2e36')]))
    d.append(lin('post', [(0, '#53656e'), (1, '#2c3a42')], 0, 0, 1, 0))
    d.append(lin('devF', [(0, '#2c3d46'), (1, '#1a252c')]))
    d.append(lin('devT', [(0, '#4a5f69'), (1, '#33454e')]))
    d.append(lin('devS', [(0, '#1d2a31'), (1, '#10181d')], 0, 0, 1, 0))
    d.append(lin('feF', [(0, '#1f3f4c'), (1, '#142a33')]))
    d.append(lin('vm', [(0, '#1d2b33'), (1, '#131d23')], 0, 0, 1, 0))
    d.append(lin('screen', [(0, '#10222b'), (1, '#0a161c')]))
    d.append(lin('sideGlass', [(0, '#7fb6c9', .16), (1, '#7fb6c9', .05)], 0, 0, 1, 0))
    d.append('<filter id="sh" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="8"/></filter>')
    d.append('<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    d.append('<filter id="gl2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>')
    return '<defs>%s</defs>' % ''.join(d)

def mk(narrow=False):
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 680" role="img" aria-labelledby="rk-t rk-d" focusable="false" preserveAspectRatio="xMidYMid meet">')
    o.append('<title id="rk-t">Fully built generic 42U four-post rack</title>')
    o.append('<desc id="rk-d">Layered 2.5D view of an unbranded rack under an overhead ladder rack, bonded to the wall grounding busbar. Fiber trunk, enclosure, labeled patch panels, switches, dressed bundles with hook-and-loop wraps, splice tray and an illustrative test trace.</desc>')
    o.append(defs())
    o.append(rect(0, 0, 480, 680, 'url(#bg)'))
    o.append(ell(250, 330, 280, 300, 'url(#glowBg)'))
    # ---- room: back wall + floor ----
    wx0, wx1 = -4.4, 7.0
    o.append(poly(P, [P2(wx0, BW, 0), P2(wx1, BW, 0), P2(wx1, BW, 13), P2(wx0, BW, 13)], 'url(#wallG)'))
    for gx in [-3.2, -1.1, 1.9, 4.9]:
        o.append(path('M%s %s L%s %s' % (*P2(gx, BW, 0), *P2(gx, BW, 13)), '#3a4f5a', 1, op=.45))
    o.append(path('M%s %s L%s %s' % (*P2(wx0, BW, 5.6), *P2(wx1, BW, 5.6)), '#3a4f5a', 1, op=.3))
    o.append(poly(P, [P2(wx0, 0, 0), P2(wx1, 0, 0), P2(wx1, BW, 0), P2(wx0, BW, 0)], 'url(#floorG)'))
    for gx in range(-2, 7):
        o.append(path('M%s %s L%s %s' % (*P2(gx, 0, 0), *P2(gx, BW, 0)), '#4a5f69', 1, op=.35))
    for gy in [.7, 1.4, 2.1]:
        o.append(path('M%s %s L%s %s' % (*P2(wx0, gy, 0), *P2(wx1, gy, 0)), '#4a5f69', 1, op=.3))
    # floor front edge
    o.append(front(P, wx0, 0, -.28, wx1 - wx0, .28, '#46565e', None, 0, 0))
    o.append(path('M%s %s L%s %s' % (*P2(wx0, 0, 0), *P2(wx1, 0, 0)), '#ffffff', 1, op=.25))
    # shadows
    o.append(poly(P, [P2(.1, -.15, 0), P2(RW + .8, -.15, 0), P2(RW + 1.6, RD + .5, 0), P2(.6, RD + .5, 0)], '#000', op=.6, extra='filter="url(#sh)"'))
    o.append(poly(P, [P2(-.2, BW, 1.0), P2(RW + .5, BW, 1.0), P2(RW + .3, BW, 9.4), P2(-.2, BW, 9.4)], '#000', op=.22, extra='filter="url(#sh)"'))

    # ---- wall TGB (grounding busbar) + bond cable ----
    tg = P2(-3.0, BW, 1.1)
    o.append(rect(tg[0], tg[1], 1.6 * S, 7, CA, '#ffe2b0', .8, 2))
    for k_ in range(6):
        o.append(circ(tg[0] + 9 + k_ * 12, tg[1] + 3.5, 1.4, '#2a1b0a'))
    o.append(rect(tg[0] - 2, tg[1] + 7, 5, 8, '#6b4a1f', None, 0, 1))
    o.append(rect(tg[0] + 1.6 * S - 3, tg[1] + 7, 5, 8, '#6b4a1f', None, 0, 1))
    # ---- overhead ladder rack (runs along x above the rack) ----
    lz = 8.75
    for yy in (.75, 1.45):
        o.append(path('M%s %s L%s %s' % (*P2(-.9, yy, lz), *P2(RW + .9, yy, lz)), '#d6e2e8', 4))
        o.append(path('M%s %s L%s %s' % (*P2(-.9, yy, lz + .11), *P2(RW + .9, yy, lz + .11)), '#ffffff', 1.2, op=.5))
    rungs = 15
    for i in range(rungs + 1):
        xx = -.8 + i * (RW + 1.6) / rungs
        o.append(path('M%s %s L%s %s' % (*P2(xx, .75, lz), *P2(xx, 1.45, lz)), '#8a9ca5', 2.2))
    # hangers to the ceiling (off the top of the frame) and to the rack frame
    for hx in (-.4, RW + .4):
        o.append(path('M%s %s L%s %s' % (*P2(hx, 1.1, lz + .05), *P2(hx, 1.1, 10.4)), '#6a7b83', 2.4))
    o.append(path('M%s %s L%s %s' % (*P2(RW / 2, 1.1, lz), *P2(RW / 2, 1.1, ZT + .12)), '#6a7b83', 2.4))

    # ---- rack frame ----
    # right side panel (translucent glass), back posts
    o.append(side(P, RW, 0, ZB, RD, ZT - ZB, 'url(#sideGlass)', '#7fb6c9', 1))
    for (px_, py_) in [(0, RD), (RW, RD)]:
        o.append(path('M%s %s L%s %s' % (*P2(px_, py_, ZB), *P2(px_, py_, ZT)), '#3a4b54', 3.5, op=.85))
    o.append(poly(P, [P2(0, 0, ZB), P2(RW, 0, ZB), P2(RW, RD, ZB), P2(0, RD, ZB)], '#101a20', '#3a5360', 1.2))
    # interior of the rack (dark well), front plane
    o.append(front(P, VM, 0, ZB, RW - 2 * VM, ZT - ZB, '#06090c', None, 0, 0))
    # posts with rail holes
    for pxx in (VM - .16, RW - VM):
        o.append(front(P, pxx, 0, ZB, .16, ZT - ZB, 'url(#post)', '#6a7b83', .8, 1))
        hp = P2(pxx + .08, 0, ZB + .08)
        o.append(path('M%s %s L%s %s' % (hp[0], hp[1], hp[0], hp[1] - (ZT - ZB - .16) * S), '#05090c', 2.6, dash='.1 5.2'))
    # top and base frames
    o.append(top(P, 0, 0, ZT, RW, RD, 'url(#devT)', '#6a7b83', 1))
    o.append(front(P, 0, 0, ZT - .22, RW, .22, 'url(#post)', '#7a8b93', 1, 2))
    o.append(front(P, 0, 0, ZB, RW, .22, 'url(#post)', '#7a8b93', 1, 2))
    # vertical managers (left, right) with fingers
    def vman(x0):
        out = front(P, x0, 0, ZB + .22, VM, ZT - ZB - .44, 'url(#vm)', '#4a6270', 1.1, 2)
        n = int((ZT - ZB - .44) / .26)
        for i in range(n):
            zz = ZB + .3 + i * .26
            p0 = P2(x0 + .1, 0, zz)
            out += path('M%s %s L%s %s' % (p0[0], p0[1], p0[0] + (VM - .2) * S, p0[1]), '#566d79', 1.6, op=.9)
        return out
    o.append(vman(0))
    o.append(vman(RW - VM))

    # ---- devices, top to bottom ----
    x0, x1 = VM, RW - VM
    wdev = x1 - x0
    zc = ZT - .3
    def dev_box(h, fillF='url(#devF)', stroke='#5b6b73'):
        nonlocal zc
        zc -= h
        out = top(P, x0, 0, zc + h, wdev, .25, 'url(#devT)', None, 0) + front(P, x0, 0, zc, wdev, h, fillF, stroke, 1.1, 2)
        return out, zc
    # fiber enclosure
    out, z_ = dev_box(.52, 'url(#feF)', CY)
    o.append(out)
    fe_z = z_
    for i in range(6):
        px_, py_ = P2(x0 + .1 + i * (wdev - .2) / 6, 0, z_ + .46)
        o.append(rect(px_, py_, (wdev - .2) / 6 * S - 3, .4 * S, '#0a1a21', CY, .9, 2, op=.95))
        o.append(circ(px_ + 7, py_ + 8, 1.7, CY))
        o.append(circ(px_ + 15, py_ + 8, 1.7, CY))
    zc -= .06
    def hman():
        nonlocal zc
        zc -= .17
        px_, py_ = P2(x0, 0, zc + .17)
        out = rect(px_, py_, wdev * S, .17 * S, '#16222a', '#4a5a62', .8, 1)
        for i in range(16):
            out += rect(px_ + 6 + i * (wdev * S - 12) / 16, py_ + 3, 1.6, .17 * S - 6, '#4a5a62', None, 0, 0)
        return out
    cp_z = []
    sw_z = []
    for i in range(3):
        o.append(hman())
        out, z_ = dev_box(.34)
        o.append(out)
        cp_z.append(z_)
        px_, py_ = P2(x0, 0, z_ + .34)
        for j in range(24):
            xx = px_ + 6 + j * (wdev * S - 12) / 24
            o.append(rect(xx, py_ + 11, 4.6, 6, '#050a0d', CA, .6, 0))
            if j % 6 == 0:
                o.append(rect(xx - .5, py_ + 3, 3.2, 3.2, '#dff5ff', None, 0, 0))
    o.append(hman())
    for i in range(2):
        out, z_ = dev_box(.3)
        o.append(out)
        sw_z.append(z_)
        px_, py_ = P2(x0, 0, z_ + .3)
        for j in range(24):
            xx = px_ + 6 + j * (wdev * S - 12) / 24
            o.append(rect(xx, py_ + 12, 4.6, 5, '#050a0d', None, 0, 0))
            o.append(circ(xx + 2.3, py_ + 8, 1.2, CG if (j + i) % 5 else '#ffd36a'))
        o.append(rect(px_ + wdev * S - 34, py_ + 5, 26, 4, '#1a2831', '#4a5a62', .5, 1))
    zc -= .06
    o.append(hman())
    # splice tray
    sp_h = .98
    zc -= sp_h
    sp_z = zc
    o.append(top(P, x0, 0, zc + sp_h, wdev, .3, 'url(#devT)', None, 0) + front(P, x0, 0, zc, wdev, sp_h, 'url(#feF)', CY, 1.3, 4))
    sx, sy = P2(x0, 0, zc + sp_h)
    scy = sy + sp_h * S / 2
    o.append(path('M%s %s H%s' % (sx + 14, scy, sx + 60), CY, 3))
    o.append(path('M%s %s H%s' % (sx + wdev * S - 60, scy, sx + wdev * S - 14), CY, 3))
    o.append(path('M%s %s C%s %s %s %s %s %s' % (sx + 14, scy, sx + 14, scy - 26, sx + 46, scy - 26, sx + 46, scy), CY, 2, op=.7))
    o.append(path('M%s %s C%s %s %s %s %s %s' % (sx + wdev * S - 46, scy, sx + wdev * S - 46, scy + 26, sx + wdev * S - 14, scy + 26, sx + wdev * S - 14, scy), CY, 2, op=.7))
    mid = sx + wdev * S / 2
    o.append(ell(mid, scy, 20, 20, '#fff6c9', op=.28, extra='filter="url(#gl2)"'))
    o.append(path('M%s %s l5 -14 l4 11 l11 -4 l-9 9 l9 8 l-12 -2 l-3 12 l-5 -12 l-12 3 l9 -9 l-9 -8 l12 3z' % (mid - 4, scy), '#ffd36a', 1, fill='#fff6c9'))
    o.append(rect(mid - 36, scy - 4, 28, 8, '#d9c9ff', '#8d70d6', 1, 4))
    o.append(rect(mid + 8, scy - 4, 28, 8, '#d9c9ff', '#8d70d6', 1, 4))
    zc -= .16
    # test-trace drawer / screen
    tr_h = 1.95
    zc -= tr_h
    tr_z = zc
    o.append(top(P, x0, 0, zc + tr_h, wdev, .3, 'url(#devT)', None, 0) + front(P, x0, 0, zc, wdev, tr_h, 'url(#devF)', '#5b6b73', 1.2, 4))
    tx, ty = P2(x0 + .16, 0, zc + tr_h - .14)
    tw, th = (wdev - .32) * S, (tr_h - .3) * S
    o.append(rect(tx, ty, tw, th, 'url(#screen)', '#3a5360', 1.2, 4))
    o.append(path('M%s %s V%s H%s' % (tx + 12, ty + 14, ty + th - 40, tx + tw - 12), '#4a5a62', 1.4))
    tr = 'M%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s L%s %s' % (
        tx + 18, ty + 16, tx + tw * .30, ty + 18, tx + tw * .34, ty + 38, tx + tw * .38, ty + 20,
        tx + tw * .62, ty + 22, tx + tw * .66, ty + 42, tx + tw * .70, ty + 24, tx + tw - 16, ty + 27)
    o.append(path(tr, CG, 3.4, op=.35, extra='filter="url(#gl2)"'))
    o.append(path(tr, CG, 2.6))
    pw = 100
    o.append(rect(tx + tw / 2 - pw / 2, ty + th - 28, pw, 22, '#143327', CG, 1.2, 11))
    o.append(path('M%s %s l5 5 l9 -10' % (tx + tw / 2 - pw / 2 + 12, ty + th - 17), CG, 2.6))
    o.append(rect(tx + tw / 2 - 18, ty + th - 22, 52, 3.4, CG, None, 0, 1.7, op=.8))
    o.append(rect(tx + tw / 2 - 18, ty + th - 15, 34, 3.4, CG, None, 0, 1.7, op=.5))
    for i in range(3):
        zc -= .2
        if zc > ZB + .26:
            bp = P2(x0, 0, zc + .17)
            o.append(rect(bp[0], bp[1], wdev * S, .17 * S, '#10191e', '#33444d', .8, 1))
    # ---- fiber trunk: ladder rack -> enclosure right edge ----
    ent = P2(x1 - .02, 0, fe_z + .3)
    top_ = P2(RW - .5, 1.1, lz + .02)
    mid_ = P2(RW - .5, 0, lz - .45)
    trunk = 'M%s %s C%s %s %s %s %s %s L%s %s' % (top_[0], top_[1], top_[0], top_[1] + 30, mid_[0] + 6, mid_[1] - 20, mid_[0] - 4, mid_[1] + 20, ent[0], ent[1])
    o.append(path(trunk, CY, 9, op=.28, extra='filter="url(#gl2)"'))
    o.append(path(trunk, '#0c161c', 7))
    o.append(path(trunk, CY, 4.2, extra='filter="url(#gl)"'))
    o.append(path(trunk, '#b9eefb', 1.2, op=.55))

    # ---- dressed bundles on the left: patch panels -> switches, hook-and-loop wraps, label tags ----
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
        xa, xb = P2(x0 + .12 + k_ * .1, 0, 0)[0], P2(x0 + .12 + k_ * .1, 0, 0)[0]
        xl = P2(.18 + k_ * .09, 0, 0)[0]
        d_ = 'M%s %s H%s C%s %s %s %s %s %s H%s' % (xa, ya, xa - 6, xl - 28, ya, xl - 28, yb, xa - 6, yb, xb)
        d_ = 'M%s %s C%s %s %s %s %s %s S%s %s %s %s' % (xa, ya, xa - 20, ya, xl, ya + 16, xl, (ya + yb) / 2, xa - 20, yb, xb, yb)
        o.append(path(d_, '#0c161c', 4.6, op=.8))
        o.append(path(d_, col, 3))
    # wraps: amber hook-and-loop straps with a tab
    ys = sorted([pz(cp_z[0], .34), pz(cp_z[1], .34), pz(cp_z[2], .34), pz(sw_z[0], .3), pz(sw_z[1], .3)])
    wraps = []
    for yw in [ys[0] + 16, ys[1] + 18, ys[2] + 16, ys[3] + 12]:
        bxl = P2(.14, 0, 0)[0]
        o.append(rect(bxl, yw, 30, 5.5, CA, '#2a1b0a', .7, 1.5))
        o.append(rect(bxl + 24, yw - 3.5, 6, 6, '#f1c98a', '#2a1b0a', .5, 1))
        wraps.append((bxl, yw))
    tags = []
    for yw in [ys[0] - 3, ys[2] - 3, ys[4] - 4]:
        tx_ = P2(x0, 0, 0)[0] - 15
        o.append(rect(tx_, yw, 13, 7, '#f2f6f8', '#1b252b', .6, 1))
        tags.append((tx_, yw))

    bondo = []
    rp = P2(0.04, 0, ZB + .62)
    bond = 'M%s %s C%s %s %s %s %s %s' % (tg[0] + 1.6 * S - 4, tg[1] + 12, tg[0] + 1.6 * S + 30, tg[1] + 60, rp[0] - 50, rp[1] + 10, rp[0], rp[1])
    bondo.append(path(bond, '#0c161c', 5))
    bondo.append(path(bond, '#9bd36a', 3))
    bondo.append(rect(rp[0] - 4, rp[1] - 5, 9, 10, '#9bd36a', '#2a3b17', .8, 2))

    o.extend(bondo)
    # ---- labels ----
    lab = []
    fs = 17 if narrow else 12.5
    def width(t):
        return len(t) * fs * 0.56 + 14
    def L(anchor, col, pos, t):
        w, h = width(t), fs + 9
        if col == 'L':
            ex_, ey_ = pos[0] + w, pos[1]
            lab.append(pill(pos[0], pos[1], t, fs, 'start'))
        else:
            ex_, ey_ = pos[0] - w, pos[1]
            lab.append(pill(pos[0], pos[1], t, fs, 'end'))
        lab.insert(0, path('M%s %s L%s %s' % (anchor[0], anchor[1], ex_, ey_), '#9fb2ba', 1, op=.85))
        lab.insert(1, circ(anchor[0], anchor[1], 2.6, '#e6eef1'))
    ci = P2(x1 - .25, 0, cp_z[0] + .17)
    items = [
        ('lad', 'Overhead ladder rack', P2(3.6, .75, lz), 'R', (472, 96)),
        ('trk', 'Fiber trunk', (top_[0] + 6, top_[1] + 18), 'R', (472, 132)),
        ('fe', 'Fiber enclosure', P2(x1 - .5, 0, fe_z + .22), 'R', (472, 168)),
        ('cp', 'Copper patch panel', P2(x1 - .4, 0, cp_z[1] + .17), 'R', (472, 232)),
        ('sw', 'Switch', P2(x1 - .5, 0, sw_z[0] + .15), 'R', (472, 318)),
        ('spl', 'Splice tray', P2(x1 - .3, 0, sp_z + .5), 'R', (472, 392)),
        ('trc', 'Test trace (illustrative)', P2(x1 - .4, 0, tr_z + 1.0), 'R', (472, 470)),
        ('wrp', 'Hook-and-loop wraps', (wraps[1][0] + 14, wraps[1][1] + 3), 'L', (8, 214)),
        ('tag', 'Label tags', (tags[1][0] + 6, tags[1][1] + 3), 'L', (8, 170)),
        ('tgb', 'Wall TGB bond', (tg[0] + 40, tg[1] + 3), 'L', (8, 612)),
    ]
    keep = ['trk', 'wrp', 'trc', 'tgb'] if narrow else [a[0] for a in items]
    for key, t, anc, col, pos in items:
        if key in keep:
            L(anc, col, pos, t)
    o.append('<g>%s</g>' % '\n'.join(lab))
    o.append('</svg>')
    return '\n'.join(o)

if __name__ == '__main__':
    print(mk(len(sys.argv) > 1 and sys.argv[1] == 'narrow'))
