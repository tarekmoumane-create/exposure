"""
Builds every icon file for Exposure from one master. Run: python3 scripts/brand-assets.py

The icon, "the exposure": a single frame of 35 mm film in the dark, filling with light, overexposed
to warm white with an amber bloom and a red halation fringe, its sprocket holes lit by the spill.
The master (assets/brand/icon-master.png, 2048px) is rendered artwork; this script
only crops, rounds and resizes it, and draws the single-colour Android silhouette by hand.
The in-app mark (src/components/logo-mark.tsx) uses mark.png, the same art as a small rounded tile.
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'images')
MASTER = Image.open(os.path.join(ROOT, 'assets', 'brand', 'icon-master.png')).convert('RGB')
SS = 4


def art(size):
    return MASTER.resize((size, size), Image.LANCZOS)


def rounded(size, radius=0.225):
    """The icon as a rounded tile on transparency, with the same corner as the iOS home screen."""
    big = art(size * SS).convert('RGBA')
    mask = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=int(size * SS * radius), fill=255)
    big.putalpha(mask)
    return big.resize((size, size), Image.LANCZOS)


def fit(im, size, scale):
    inner = int(size * scale)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return out


def silhouette(size):
    """Android's themed icon: the frame and its two rows of sprocket holes, in white on transparency."""
    s = size * SS
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    white = (255, 255, 255, 255)
    d.rounded_rectangle([s * 0.26, s * 0.34, s * 0.74, s * 0.66], radius=s * 0.03, fill=white)
    hole_w, hole_h = s * 0.028, s * 0.034
    for i in range(7):
        x = s * 0.27 + i * (s * 0.46 - hole_w) / 6
        for y in (s * 0.285, s * 0.68):
            d.rounded_rectangle([x, y, x + hole_w, y + hole_h], radius=hole_w * 0.3, fill=white)
    return im.resize((size, size), Image.LANCZOS)


def save(im, name):
    im.save(os.path.join(OUT, name))
    print('wrote', name, im.size)


save(art(1024), 'icon.png')
save(fit(rounded(512), 512, 0.9), 'splash-icon.png')
save(art(1024).convert('RGBA'), 'android-icon-background.png')
save(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), 'android-icon-foreground.png')
save(fit(silhouette(1024), 1024, 0.72), 'android-icon-monochrome.png')
save(rounded(64), 'favicon.png')
save(rounded(192), 'mark.png')
