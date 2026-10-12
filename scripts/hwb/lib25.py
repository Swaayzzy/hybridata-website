"""Tiny 2.5D (oblique-isometric) SVG helpers. Pure SVG output: presentation attributes only, no style="", no raster."""
import math

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
