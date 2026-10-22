#!/usr/bin/env python3
"""LIGHT-936: wire the Commons splicer photo into Services card 03 in /a/ and /b/, retire testing-* and add the credit (one-shot)."""
import glob, os, re, shutil
ALT = "Technician's hands loading fibre into a fusion splicer"
NOTE = 'Cropped and colour-graded; resized, darkened and tinted blue; converted to WebP and AVIF.'
CARD = ('<li class="credit-card"><span>27</span><h2>Fujikura-Fusion Splicer 70S-Splice-01ASD</h2><p>Services overview — Fusion splicing and fiber testing card</p>'
        '<p><strong>Asurnipal</strong> · CC BY-SA 4.0</p><p class="license-note"><strong>Share-alike notice:</strong> this adapted WebP and AVIF remains available under CC BY-SA 4.0.</p>'
        '<div class="credit-links"><a href="https://commons.wikimedia.org/wiki/File:Fujikura-Fusion_Splicer_70S-Splice-01ASD.jpg" target="_blank" rel="noopener noreferrer">Source record ↗</a>'
        '<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">License terms ↗</a></div><small>' + NOTE + '</small></li>')
for v in ('a', 'b'):
    for f in glob.glob('out/service-fusion-splicer-*'):
        shutil.copy(f, f'{v}/assets/photos/')
    for old in glob.glob(f'{v}/assets/photos/testing-*'):
        os.remove(old)
    p = f'{v}/services.html'; s = open(p).read()
    new, n = re.subn(r'<figure class="realistic-visual service-map-photo" data-photo-key="testing">.*?</figure>',
        lambda m: ('<figure class="realistic-visual service-map-photo" data-photo-key="service-fusion-splicer"><picture>'
        '<source media="(max-width: 680px)" type="image/avif" srcset="assets/photos/service-fusion-splicer-mobile.avif" width="546" height="683">'
        '<source media="(max-width: 680px)" type="image/webp" srcset="assets/photos/service-fusion-splicer-mobile.webp" width="546" height="683">'
        '<source type="image/avif" srcset="assets/photos/service-fusion-splicer-desktop.avif" width="1024" height="640">'
        '<img src="assets/photos/service-fusion-splicer-desktop.webp" alt="%s" width="1024" height="640" loading="lazy" decoding="async"></picture></figure>') % ALT, s, flags=re.S)
    assert n == 1; open(p, 'w').write(new)
    p = f'{v}/photo-credits.html'; s = open(p).read()
    assert s.count('</li></ol>') == 1
    open(p, 'w').write(s.replace('</li></ol>', '</li>' + CARD + '</ol>'))
