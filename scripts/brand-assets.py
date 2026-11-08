"""
Draws the Exposure mark and every icon file from one geometry, so the icon, splash and in-app
LogoMark (src/components/logo-mark.tsx) always agree. Run: python3 scripts/brand-assets.py
The mark: an ink frame with a safelight-red sun rising behind it; the sun is cut out of the frame.
"""
import os
from PIL import Image, ImageDraw

PAPER = (243, 238, 230, 255)
INK = (29, 26, 23, 255)
RED = (196, 70, 43, 255)
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
SS = 4  # supersampling for smooth edges


def mark(size, ink=INK, sun=RED, ground=PAPER):
    """The mark in a size x size box, same proportions as LogoMark. ground=None cuts to transparent."""
    s = size * SS
    sun_box = [0.38 * s, 0.04 * s, 0.94 * s, 0.60 * s]
    frame_box = [0, 0.30 * s, s - 1, 0.96 * s]
    radius = 0.08 * s
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse(sun_box, fill=sun)
    d.rounded_rectangle(frame_box, radius=radius, fill=ink)
    # Where the sun sits inside the frame, the frame is cut away.
    frame_mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(frame_mask).rounded_rectangle(frame_box, radius=radius, fill=255)
    sun_mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(sun_mask).ellipse(sun_box, fill=255)
    hole = Image.composite(sun_mask, Image.new('L', (s, s), 0), frame_mask)
    im.paste(ground if ground is not None else (0, 0, 0, 0), mask=hole)
    return im.resize((size, size), Image.LANCZOS)


def canvas(size, bg, mark_size, **kw):
    im = Image.new('RGBA', (size, size), bg)
    m = mark(mark_size, **kw)
    # Optically centred: the mark's visual mass sits slightly low, so lift it a touch.
    im.alpha_composite(m, ((size - mark_size) // 2, (size - mark_size) // 2 - int(size * 0.015)))
    return im


def save(im, name):
    im.save(os.path.join(OUT, name))
    print('wrote', name, im.size)


save(canvas(1024, PAPER, 560), 'icon.png')
save(canvas(512, (0, 0, 0, 0), 300, ground=None), 'splash-icon.png')
save(Image.new('RGBA', (1024, 1024), PAPER), 'android-icon-background.png')
save(canvas(1024, (0, 0, 0, 0), 440, ground=None), 'android-icon-foreground.png')
save(canvas(1024, (0, 0, 0, 0), 440, ink=WHITE, sun=WHITE, ground=None), 'android-icon-monochrome.png')
save(canvas(64, PAPER, 44), 'favicon.png')
save(mark(256, ground=None), 'mark.png')
