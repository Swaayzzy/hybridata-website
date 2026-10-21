#!/usr/bin/env python3
"""Regenerate b/*.html from site/*.html: same markup, Version B head (noindex, own CSS/JS)."""
import re, glob, os
HEAD = ''.join('<link rel="preload" href="assets/fonts/%s-normal.woff2" as="font" type="font/woff2" crossorigin>' % n for n in (
        'space-grotesk-latin-500', 'space-grotesk-latin-700', 'ibm-plex-sans-latin-400', 'ibm-plex-sans-latin-600',
        'ibm-plex-mono-latin-400', 'ibm-plex-mono-latin-500', 'ibm-plex-mono-arrows')) + (
        '<link rel="stylesheet" href="assets/b.css"><script src="assets/b-init.js"></script>'
        '<script src="assets/b-nav.js" defer></script><script src="assets/b.js" defer></script>')
for f in sorted(glob.glob('site/*.html')):
    s = open(f).read()
    s = re.sub(r'<link rel="preload"[^>]*>', '', s)
    s = re.sub(r'<link rel="stylesheet" href="assets/site\.bundle\.css">(<link rel="stylesheet" href="assets/stage\.css">)?<script src="assets/site\.js" defer></script>', HEAD, s)
    assert 'assets/b.css' in s, f
    s = s.replace('<meta name="viewport"', '<meta name="robots" content="noindex, nofollow"><meta name="viewport"', 1)
    open('b/' + os.path.basename(f), 'w').write(s)
