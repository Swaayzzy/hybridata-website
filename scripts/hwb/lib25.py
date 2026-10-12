"""Tiny 2.5D (oblique-isometric) SVG helpers. Pure SVG output: presentation attributes only, no style="", no raster."""
import math
import os

class Proj:
    # depth axis (+y) runs back and to the right at 30 degrees, foreshortened; x right, z up
    def __init__(self, S, ox, oy, k=0.55, ang=30):
        self.S, self.ox, self.oy = S, ox, oy
        self.dx = k * math.cos(math.radians(ang))
        self.dy = k * math.sin(math.radians(ang))
    def p(self, x, y, z):
        return (self.ox + (x + self.dx * y) * self.S, self.oy - (z + self.dy * y) * self.S)

def f(n):
    s = ('%.1f' % n).rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'

def pts(lst):
    return ' '.join('%s,%s' % (f(a), f(b)) for a, b in lst)

def attrs(**kw):
    out = []
    for k, v in kw.items():
        if v is None:
            continue
        out.append('%s="%s"' % (k.replace('_', '-'), v))
    return ' '.join(out)

def poly(P, lst, fill, stroke=None, sw=1, op=None, extra=''):
    return '<polygon points="%s" %s %s/>' % (pts(lst), attrs(fill=fill, stroke=stroke, stroke_width=sw if stroke else None, stroke_linejoin='round' if stroke else None, opacity=op), extra)

def rect(x, y, w, h, fill, stroke=None, sw=1, rx=0, op=None, extra=''):
    return '<rect %s %s/>' % (attrs(x=f(x), y=f(y), width=f(w), height=f(h), rx=f(rx) if rx else None, fill=fill, stroke=stroke, stroke_width=sw if stroke else None, opacity=op), extra)

def path(d, stroke=None, sw=1, fill='none', op=None, cap='round', join='round', dash=None, extra=''):
    return '<path %s %s/>' % (attrs(d=d, fill=fill, stroke=stroke, stroke_width=sw if stroke else None, stroke_linecap=cap if stroke else None, stroke_linejoin=join if stroke else None, stroke_dasharray=dash, opacity=op), extra)

def front(P, x, y, z, w, h, fill, stroke=None, sw=1, rx=2, op=None):
    px, py = P.p(x, y, z + h)
    return rect(px, py, w * P.S, h * P.S, fill, stroke, sw, rx, op)

def top(P, x, y, z, w, d, fill, stroke=None, sw=1, op=None):
    return poly(P, [P.p(x, y, z), P.p(x + w, y, z), P.p(x + w, y + d, z), P.p(x, y + d, z)], fill, stroke, sw, op)

def side(P, x, y, z, d, h, fill, stroke=None, sw=1, op=None):
    """face on the plane at x, spanning depth d and height h (the right-hand face of a box)."""
    return poly(P, [P.p(x, y, z), P.p(x, y + d, z), P.p(x, y + d, z + h), P.p(x, y, z + h)], fill, stroke, sw, op)

def box(P, x, y, z, w, d, h, gf, gt, gs, stroke=None, sw=1, rx=2):
    return side(P, x + w, y, z, d, h, gs, stroke, sw) + top(P, x, y, z + h, w, d, gt, stroke, sw) + front(P, x, y, z, w, h, gf, stroke, sw, rx)

def ell(cx, cy, rx, ry, fill, stroke=None, sw=1, op=None, dash=None, extra=''):
    return '<ellipse %s %s/>' % (attrs(cx=f(cx), cy=f(cy), rx=f(rx), ry=f(ry), fill=fill, stroke=stroke, stroke_width=sw if stroke else None, stroke_dasharray=dash, opacity=op), extra)

def circ(cx, cy, r, fill, stroke=None, sw=1, op=None):
    return '<circle %s/>' % attrs(cx=f(cx), cy=f(cy), r=f(r), fill=fill, stroke=stroke, stroke_width=sw if stroke else None, opacity=op)

def text(x, y, s, size, fill, anchor='start', weight=600, extra=''):
    return '<text %s %s>%s</text>' % (attrs(x=f(x), y=f(y), font_family='Inter, Arial, sans-serif', font_size=size, font_weight=weight, fill=fill, text_anchor=anchor), extra, s)

def pill(x, y, s, size, anchor='start', fg='#e6eef1', bg='#0d1a21', stroke='#3a5360', pad=7):
    w = len(s) * size * 0.56 + pad * 2
    h = size + 9
    bx = x if anchor == 'start' else (x - w if anchor == 'end' else x - w / 2)
    return (rect(bx, y - h / 2, w, h, bg, stroke, 1, h / 2, 0.92) + text(bx + w / 2, y + size * 0.36, s, size, fg, 'middle'))

def g(inner, **kw):
    return '<g %s>\n%s\n</g>' % (attrs(**kw), inner)

def lin(id_, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join('<stop %s/>' % attrs(offset=o, stop_color=c, stop_opacity=op if op is not None else None) for o, c, *rest in stops for op in [rest[0] if rest else None])
    return '<linearGradient %s>%s</linearGradient>' % (attrs(id=id_, x1=x1, y1=y1, x2=x2, y2=y2), s)

def rad(id_, stops):
    s = ''.join('<stop %s/>' % attrs(offset=o, stop_color=c, stop_opacity=op if op is not None else None) for o, c, *rest in stops for op in [rest[0] if rest else None])
    return '<radialGradient %s>%s</radialGradient>' % (attrs(id=id_), s)


# ---------------------------------------------------------------------------------------------
# LIGHT-503: layered output. Every drawn piece is added to a Scene with the step it first appears
# on (frm), the system it belongs to, and a parallax layer (px 0 back .. 2 front). The player CSS
# toggles the groups; the static stills drop every class so they stay pure presentation attributes.
class Scene:
    def __init__(self):
        self.items = []

    def add(self, svg, px=1, frm=0, sys='', cls=''):
        if isinstance(svg, (list, tuple)):
            svg = '\n'.join(svg)
        self.items.append((px, frm, sys, cls, svg))

    def render(self, mode='player'):
        out = []
        for px in (0, 1, 2):
            runs = []
            for (p, frm, sys, cls, svg) in self.items:
                if p != px:
                    continue
                key = (frm, sys, cls)
                if runs and runs[-1][0] == key:
                    runs[-1][1].append(svg)
                else:
                    runs.append((key, [svg]))
            inner = []
            for (frm, sys, cls), parts in runs:
                body = '\n'.join(parts)
                if mode == 'still':
                    if set(cls.split()) & {'stage1', 'facade', 'roof'}:
                        continue
                    inner.append('<g>%s</g>' % body)
                elif frm == 0:
                    inner.append('<g class="B%s">%s</g>' % ((' ' + cls) if cls else '', body))
                else:
                    inner.append('<g class="L%s" data-from="%d" data-system="%s">%s</g>' % ((' ' + cls) if cls else '', frm, sys, body))
            out.append('<g%s>%s</g>' % (('' if mode == 'still' else ' class="px" data-px="%d"' % px), '\n'.join(inner)))
        return '\n'.join(out)


def draw(d, color, sw, dl=0, halo=True, fid=None, op=1):
    """A cable run that draws itself along its path in the player (pathLength=1 + stroke-dashoffset)."""
    s = ''
    cls = 'draw dl%d' % dl if dl else 'draw'
    if halo:
        s += path(d, color, sw + 5, op=.26, extra='class="%s" pathLength="1"%s' % (cls, (' filter="url(#%s)"' % fid) if fid else ''))
    s += path(d, '#0c161c', sw + 2.6, extra='class="%s" pathLength="1"' % cls)
    s += path(d, color, sw, op=op if op != 1 else None, extra='class="%s" pathLength="1"' % cls)
    return s


def bad(msg):
    if os.environ.get('HWB_LAX'):
        print('WARN', msg, file=__import__('sys').stderr)
    else:
        raise SystemExit(msg)


class Labels:
    """Callouts with a leader line. Positions are checked in code: no pill overlap, no crossing leaders,
    no leader through another pill, nothing outside the frame. Only the listed steps / systems show a label."""
    def __init__(self, vb, fs, fsn):
        self.items = []
        self.vb = vb
        self.fs = {'w': fs, 'n': fsn}

    def add(self, key, text, anchor, pos, steps=(), focus=(), narrow_pos=None, narrow_anchor=None):
        self.items.append(dict(key=key, text=text, anchor=anchor, pos=pos, steps=tuple(steps), focus=tuple(focus), npos=narrow_pos or pos, nanchor=narrow_anchor or anchor))

    @staticmethod
    def box(it, var, fs):
        w = sum(0.76 if c.isupper() else 0.6 for c in it['text']) * fs + 20
        h = fs + 11
        cx, cy = it['pos'] if var == 'w' else it['npos']
        return (cx - w / 2, cy - h / 2, w, h)

    @staticmethod
    def leader(it, var, bx):
        ax, ay = it['anchor'] if var == 'w' else it['nanchor']
        x0, y0, w, h = bx
        ex = min(max(ax, x0), x0 + w)
        ey = min(max(ay, y0), y0 + h)
        if x0 <= ax <= x0 + w and y0 <= ay <= y0 + h:
            ex, ey = ax, y0 + h
        # leave from the pill edge nearest the anchor
        if y0 < ay < y0 + h:
            ex = x0 if ax < x0 else x0 + w
        elif x0 < ax < x0 + w:
            ey = y0 if ay < y0 else y0 + h
        return (ax, ay, ex, ey)

    @staticmethod
    def _seg(a, b):
        def ccw(p, q, r):
            return (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0])
        p1, p2, p3, p4 = (a[0], a[1]), (a[2], a[3]), (b[0], b[1]), (b[2], b[3])
        return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)

    @staticmethod
    def _seg_rect(s, r):
        x0, y0, w, h = r
        n = 24
        for i in range(1, n):
            t = i / n
            x, y = s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t
            if x0 + 1 < x < x0 + w - 1 and y0 + 1 < y < y0 + h - 1:
                return True
        return False

    def check(self, groups, cap_n=3):
        """groups: {name: [keys]}. Raises on any violation; returns a report list."""
        report = []
        for var in ('w', 'n'):
            fs = self.fs[var]
            vx, vy, vw, vh = self.vb[var]
            for name, keys in groups.items():
                its = [i for i in self.items if i['key'] in keys]
                if var == 'n' and len(its) > cap_n:
                    bad('label cap: %s has %d labels (max %d on phones)' % (name, len(its), cap_n))
                bxs = [self.box(i, var, fs) for i in its]
                lds = [self.leader(i, var, b) for i, b in zip(its, bxs)]
                for k, b in enumerate(bxs):
                    if b[0] < vx or b[1] < vy or b[0] + b[2] > vx + vw or b[1] + b[3] > vy + vh:
                        bad('label outside frame: %s/%s/%s' % (var, name, its[k]['key']))
                for a in range(len(its)):
                    for b in range(a + 1, len(its)):
                        A, B = bxs[a], bxs[b]
                        if not (A[0] + A[2] < B[0] or B[0] + B[2] < A[0] or A[1] + A[3] < B[1] or B[1] + B[3] < A[1]):
                            bad('label overlap: %s/%s: %s x %s' % (var, name, its[a]['key'], its[b]['key']))
                        if self._seg(lds[a], lds[b]):
                            bad('leaders cross: %s/%s: %s x %s' % (var, name, its[a]['key'], its[b]['key']))
                    for b in range(len(its)):
                        if a != b and self._seg_rect(lds[a], bxs[b]):
                            bad('leader through pill: %s/%s: %s -> %s' % (var, name, its[a]['key'], its[b]['key']))
                report.append('%s %s: %d labels, 0 overlaps, 0 crossings' % (var, name, len(its)))
        return report

    def render(self, mode='player', only=None, var_only=None):
        out = []
        for var in ('w', 'n'):
            if var_only and var != var_only:
                continue
            fs = self.fs[var]
            inner = []
            for it in self.items:
                if only is not None and it['key'] not in only:
                    continue
                bx = self.box(it, var, fs)
                ax, ay, ex, ey = self.leader(it, var, bx)
                x0, y0, w, h = bx
                cls = ' '.join(['lbl'] + ['s%d' % s for s in it['steps']] + ['f-%s' % f for f in it['focus']])
                body = (path('M%s %s L%s %s' % (f(ax), f(ay), f(ex), f(ey)), '#9fb2ba', 1.2, op=.9)
                        + circ(ax, ay, 3, '#e6eef1', '#0d1a21', 1)
                        + rect(x0, y0, w, h, '#0d1a21', '#3a5360', 1, h / 2, .94)
                        + text(x0 + w / 2, y0 + h / 2 + fs * .36, it['text'], fs, '#e6eef1', 'middle'))
                inner.append('<g%s>%s</g>' % ('' if mode == 'still' else ' class="%s"' % cls, body))
            out.append('<g%s>%s</g>' % ('' if mode == 'still' else ' class="lbls lbl-%s"' % var, '\n'.join(inner)))
        return '\n'.join(out)
