#!/usr/bin/env python3
"""LIGHT-922: wire the Commons Fusion page + Process 6 photos into /a/ and /b/ (replaces the Pexels patch-cord photos; one-shot)."""
import os, re, shutil, glob
FUS_ALT = 'Fibre splice tray with dressed splice protectors'
OTDR_ALT = 'Fibre OTDR test trace on the instrument screen'
def card(n, title, slot, author, lic, lic_url, src, note):
    return ('<li class="credit-card"><span>%02d</span><h2>%s</h2><p>%s</p><p><strong>%s</strong> · %s</p>'
            '<div class="credit-links"><a href="%s" target="_blank" rel="noopener noreferrer">Source record ↗</a>'
            '<a href="%s" target="_blank" rel="noopener noreferrer">License terms ↗</a></div><small>%s</small></li>') % (n, title, slot, author, lic, src, lic_url, note)
NOTE = 'Cropped and colour-graded; resized, darkened and tinted blue; converted to WebP and AVIF.'
def sub1(pat, rep, s):
    new, n = re.subn(pat, lambda m: rep, s, count=1, flags=re.S); assert n == 1, pat[:70]; return new
for v in ('a', 'b'):
    for f in glob.glob(f'out/*'):
        shutil.copy(f, f'{v}/assets/photos/')
    for old in glob.glob(f'{v}/assets/photos/process-6-records-*') + glob.glob(f'{v}/assets/photos/service-fusion-page-*'):
        os.remove(old)
    p = f'{v}/process.html'; s = open(p).read()
    s = s.replace('process-6-records-mobile.avif" width="800" height="600"', 'process-6-otdr-mobile.avif" width="633" height="791"')
    s = s.replace('process-6-records-mobile.webp" width="800" height="600"', 'process-6-otdr-mobile.webp" width="633" height="791"')
    s = s.replace('process-6-records-desktop', 'process-6-otdr-desktop').replace('data-photo-key="process-6-records"', 'data-photo-key="process-6-otdr"')
    s = sub1(r'alt="Tagged, colour-labelled[^"]*"', 'alt="%s"' % OTDR_ALT, s)
    assert 'process-6-records' not in s; open(p, 'w').write(s)
    p = f'{v}/service-fusion-splicing-fiber-testing.html'; s = open(p).read()
    s = s.replace('service-fusion-page-', 'service-fusion-splice-tray-').replace('data-photo-key="service-fusion-page"', 'data-photo-key="service-fusion-splice-tray"')
    s = sub1(r'alt="Yellow fibre-optic patch cords[^"]*"', 'alt="%s"' % FUS_ALT, s)
    assert 'service-fusion-page' not in s; open(p, 'w').write(s)
    p = f'{v}/photo-credits.html'; s = open(p).read()
    s = sub1(r'<li class="credit-card"><span>11</span>.*?</li>', card(11, 'OTDR - Yokogawa AQ7270 - 1', 'Process step 6 — Use project-defined testing and records', 'Electron', 'CC BY 3.0',
        'https://creativecommons.org/licenses/by/3.0/', 'https://commons.wikimedia.org/wiki/File:OTDR_-_Yokogawa_AQ7270_-_1.jpg', NOTE), s)
    s = sub1(r'<li class="credit-card"><span>22</span>.*?</li>', card(22, 'Fiber Splice', 'Fusion splicing and fiber testing page', 'Dhaluza at English Wikipedia', 'CC BY 3.0',
        'https://creativecommons.org/licenses/by/3.0/', 'https://commons.wikimedia.org/wiki/File:Fiber_Splice.jpg', NOTE), s)
    open(p, 'w').write(s)
    css = f'{v}/assets/{v}.css'; t = open(css).read()
    t = t.replace('  .process-step-photo img{aspect-ratio:4/3}', '  .process-step-photo img{aspect-ratio:4/3}\n  .process-step-photo[data-photo-key="process-6-otdr"] img{aspect-ratio:633/791}', 1)
    assert 'process-6-otdr' in t; open(css, 'w').write(t)
