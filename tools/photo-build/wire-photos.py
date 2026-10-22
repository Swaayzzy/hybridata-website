#!/usr/bin/env python3
"""LIGHT-891: wire the exported photos into /a/ and /b/ (markup, CSS, credits). Run from the repo root."""
import csv, glob, html, os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = ROOT + '/out/photos'
MAN = {re.search(r'pexels-(\d+)', r['filename']).group(1): r for r in csv.DictReader(open(ROOT + '/scratch/manifest.csv'))}

def pic(name, alt, w, h, mw, mh, cls='', eager=False, extra=''):
    P = 'assets/photos/' + name
    return (f'<picture{cls}><source media="(max-width: 680px)" type="image/avif" srcset="{P}-mobile.avif" width="{mw}" height="{mh}">'
            f'<source media="(max-width: 680px)" type="image/webp" srcset="{P}-mobile.webp" width="{mw}" height="{mh}">'
            f'<source type="image/avif" srcset="{P}-desktop.avif" width="{w}" height="{h}">'
            f'<img src="{P}-desktop.webp" alt="{html.escape(alt)}" width="{w}" height="{h}" '
            + ('loading="eager" decoding="async" fetchpriority="high"' if eager else 'loading="lazy" decoding="async"') + '></picture>')

PROC = [  # name, pexels id, alt
 ('process-1-context', '8470059', 'Two people in hard hats walking through an empty, unfinished interior, one pointing out a feature while holding a drawing.'),
 ('process-2-scope', '3862374', 'A laptop showing a floor plan beside a printed floor-plan drawing on a desk while a person takes handwritten notes.'),
 ('process-3-coordinate', '3862370', 'Four people at a wall whiteboard with taped notes, one writing while the others look on and plan who covers what.'),
 ('process-4-prepare', '9606949', "A technician's hands holding pliers beside an open case of sockets, wrenches and pliers, laid out ready for field work."),
 ('process-5-install', '442151', 'A technician reaching into an equipment rack with a cordless screwdriver while bundles of blue and yellow patch cable hang beside the switch.'),
 ('process-6-records', '4818711', 'Tagged, colour-labelled blue patch cords plugged into the numbered ports of a network switch.'),
 ('process-7-handoff', '4716292', 'Neatly dressed blue patch cords running from a labelled patch panel in a finished equipment rack.'),
]
SVC = {  # page -> (name, id, alt, (w,h,mw,mh), kind)
 'service-network-engineering-design-assist-consulting': ('service-engineering-page', '2881232', 'Bundle of blue Ethernet patch cables with identification labels plugged into a network switch.', (1600,1000,800,1000)),
 'service-data-center-fiber-structured-cabling': ('service-datacenter-page', '19166565', 'Rack of patch panels with grey cable bundles dressed neatly on both sides.', (1600,1000,800,1000)),
 'service-wireless-site-surveys-design-installation': ('service-wireless-page', '6342345', 'Two point-to-point radio dishes mounted on a pole against an overcast sky.', (1600,1000,800,1000)),
 'service-osp-fiber-route-permit-row-coordination': ('service-osp-page', '5273262', 'Orange corrugated duct sections laid beside an open roadside trench.', (1600,1000,800,1000)),
}
FUSION = ('service-fusion-page', '37564550', 'Yellow fibre-optic patch cords with numbered boots connected to adapters on a white termination enclosure.', (1280,800,640,800))
ACC_L = ('service-access-left', '13657444', 'Hand holding an access card up to a wall-mounted card reader with keypad and display on a concrete wall.', (800,800,640,640))
ACC_R = ('service-access-right', '13422379', 'White bullet-style security camera on a wall bracket mounted on a building exterior.', (800,800,640,640))
S01 = ('services-engineering', '442152', 'A technician holding a laptop beside an equipment rack, with white and blue patch cables running to a network switch.', (1536,1024,780,976))
LABELS = ['Data centers', 'Distribution centers', 'Commercial environments', 'Healthcare', 'Government', 'Airports']
COMP_ALT = ('Six photos in one grid, labelled data centers, distribution centers, commercial environments, healthcare, government and airports: '
            'an aisle of server racks, a warehouse aisle with a forklift, a commercial building lobby, a healthcare corridor with a radiology sign, '
            'a government assembly chamber with tiered seating, and an airport terminal concourse.')

def sub1(pat, rep, s, flags=re.S, count=1):
    new, n = re.subn(pat, lambda m: rep, s, count=count, flags=flags)
    assert n == count, (pat[:60], n)
    return new

def wire(v):
    d = v + '/'
    for f in glob.glob(SRC + '/*'):
        shutil.copy(f, d + 'assets/photos/')
    for f in glob.glob(d + 'assets/photos/industries-*'):
        if 'composite' not in f: os.remove(f)
    # process
    s = open(d + 'process.html').read()
    s = sub1(r'<div class="process-photo-story">.*?</div></div>(?=<p class="visual-disclosure">)', '', s)
    arts = list(re.finditer(r'</article></li>', s))
    assert len(arts) == 7
    for m, (name, pid, alt) in reversed(list(zip(arts, PROC))):
        fig = ('<figure class="realistic-visual process-step-photo" data-photo-key="%s">%s</figure>' % (name, pic(name, alt, 1024, 640, 800, 600)))
        s = s[:m.start()] + fig + s[m.start():]
    open(d + 'process.html', 'w').write(s)
    # services overview, step 01 (first picture)
    s = open(d + 'services.html').read()
    n, pid, alt, (w, h, mw, mh) = S01
    s = sub1(r'<picture>.*?</picture>', pic(n, alt, w, h, mw, mh), s)
    open(d + 'services.html', 'w').write(s)
    # service pages
    for pg, (n, pid, alt, (w, h, mw, mh)) in SVC.items():
        s = open(d + pg + '.html').read()
        s = sub1(r'<picture class="service-hero-media".*?</picture>', pic(n, alt, w, h, mw, mh, ' class="service-hero-media" data-photo-key="%s"' % n, eager=True), s)
        open(d + pg + '.html', 'w').write(s)
    pg = 'service-fusion-splicing-fiber-testing'
    s = open(d + pg + '.html').read(); n, pid, alt, (w, h, mw, mh) = FUSION
    s = sub1(r'(<figure class="realistic-visual testing-band" data-photo-key=")testing(">\s*)<picture>.*?</picture>', '', s, count=0) if False else s
    s = sub1(r'<figure class="realistic-visual testing-band" data-photo-key="testing">\s*<picture>.*?</picture>',
             '<figure class="realistic-visual testing-band" data-photo-key="%s">%s' % (n, pic(n, alt, w, h, mw, mh)), s)
    open(d + pg + '.html', 'w').write(s)
    pg = 'service-access-control-surveillance'
    s = open(d + pg + '.html').read()
    for (n, pid, alt, (w, h, mw, mh)), side in ((ACC_L, 'left'), (ACC_R, 'right')):
        s = sub1(r'<picture><source media="\(max-width: 680px\)" type="image/avif" srcset="assets/photos/surveillance-%s-mobile\.avif">.*?</picture>' % side, pic(n, alt, w, h, mw, mh), s)
    open(d + pg + '.html', 'w').write(s)
    # industries composite
    s = open(d + 'industries.html').read()
    lab = ''.join('<li>%s</li>' % l for l in LABELS)
    fig = ('<figure class="realistic-visual industry-photo industry-composite" data-photo-key="industries-composite">%s<ul class="industry-composite-labels" aria-hidden="true">%s</ul></figure>'
           % (pic('industries-composite', COMP_ALT, 1536, 768, 780, 990), lab))
    s = sub1(r'<figure class="realistic-visual industry-photo" data-photo-key="industries">.*?</figure>', fig, s)
    open(d + 'industries.html', 'w').write(s)
    # css
    css = d + 'assets/' + ('a.css' if v == 'a' else 'b.css')
    t = open(css).read()
    if 'process-step-photo' not in t:
        t += CSS
        open(css, 'w').write(t)
    # credits
    s = open(d + 'photo-credits.html').read()
    s = sub1(r'<h2>5 approved source photographs\.</h2>', '<h2>25 approved source photographs.</h2>', s)
    s = sub1(r'<li class="credit-card"><span>02</span>.*?</li>', '', s)
    cards = ''.join(card(i + 6, *c) for i, c in enumerate(CREDITS))
    s = sub1(r'</li></ol>(?=<p class="license-note">Some images)', '</li>' + cards + '</ol>', s)
    open(d + 'photo-credits.html', 'w').write(s)

def title(url):
    slug = url.rstrip('/').rsplit('/', 1)[1]
    slug = re.sub(r'-\d+$', '', slug)
    return slug.replace('-', ' ').capitalize()

def card(n, pid, slot, note=''):
    r = MAN[pid]
    a = html.escape(' '.join(r['author'].split()))
    return ('<li class="credit-card"><span>%02d</span><h2>%s</h2><p>%s</p><p><strong>%s</strong> · Pexels License</p>'
            '<div class="credit-links"><a href="%s" target="_blank" rel="noopener noreferrer">Source record ↗</a>'
            '<a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">License terms ↗</a></div>'
            '<small>Cropped and resized; converted to WebP and AVIF.%s</small></li>') % (n, html.escape(title(r['source_url'])), html.escape(slot), a, r['source_url'], note)

STEPS = ['Review the project context', 'Define the relevant scope', 'Coordinate information and responsibilities', 'Prepare for project-defined field work',
         'Perform the included work', 'Use project-defined testing and records', 'Hand off the agreed information']
CREDITS = ([(p[1], 'Process step %d — %s' % (i + 1, STEPS[i])) for i, p in enumerate(PROC)] +
           [('442152', 'Services 01 — Network engineering, design-assist and consulting', ' Shirt lettering cropped out.')] +
           [(pid, 'Industries composite — ' + l) for pid, l in zip(['4508751', '36398150', '8776326', '11288653', '36900080', '12940671'], LABELS)] +
           [('2881232', 'Network engineering, design-assist and consulting page'), ('19166565', 'Data center fiber and structured cabling page'),
            ('37564550', 'Fusion splicing and fiber testing page'), ('13657444', 'Access control and surveillance page, left photo'),
            ('13422379', 'Access control and surveillance page, right photo'), ('6342345', 'Wireless site surveys, design and installation page'),
            ('5273262', 'Outside-plant fiber route, permit and right-of-way page')])
CSS = """
/* LIGHT-891: one photo per process step, industries composite */
.process-step-photo{grid-column:2;margin:22px 0 0;max-width:560px}
.process-step-photo img{display:block;width:100%;height:auto;aspect-ratio:8/5;object-fit:cover}
.industry-composite{position:relative}
.industry-composite img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover}
.industry-composite-labels{position:absolute;inset:0;margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)}
.industry-composite-labels li{display:flex;align-items:flex-end;padding:0 10px 9px;font:700 clamp(15px,1.45vw,20px)/1.1 "Barlow Condensed",var(--display,sans-serif);letter-spacing:.02em;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);background:linear-gradient(0deg,rgba(3,10,16,.86),rgba(3,10,16,0) 52%)}
.ia-process-story .visual-disclosure{margin-bottom:32px}
.js:not(.reveal-all) .industry-composite:not(.is-in) .industry-composite-labels{opacity:0}
.industry-composite-labels{transition:opacity .6s .5s}
@media(max-width:680px){
  .process-step-photo{grid-column:1;max-width:none}
  .process-step-photo img{aspect-ratio:4/3}
  .industry-composite img{aspect-ratio:780/990}
  .industry-composite-labels{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(3,1fr)}
  .industry-composite-labels li{padding:0 8px 8px;font-size:16px}
}
"""
if __name__ == '__main__':
    os.chdir('site')
    for v in ('a', 'b'): wire(v)
    print('wired')
