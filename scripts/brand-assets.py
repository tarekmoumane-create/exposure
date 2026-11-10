"""
Builds every icon file for Exposure from one master. Run: python3 scripts/brand-assets.py

The icon, "the bloom": a camera aperture drawn as six soft white petals, overlapping like a flower,
on the app's rose-to-peach sunset gradient (the same gradient as the main buttons).
The master (assets/brand/icon-master.png, 1024px) is rendered artwork; this script
only rounds and resizes it, and lifts the white petals out as the single-colour Android silhouette.
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
    """Android's themed icon: the white petals lifted off the gradient, on transparency."""
    src = MASTER.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px, dst = src.load(), out.load()
    for y in range(size):
        for x in range(size):
            r, g, b = px[x, y]
            # Solid white reads as the mark; the gradient (never near-white in all three channels) does not.
            a = max(0, min(255, int((min(r, g, b) - 215) * 255 / 30)))
            dst[x, y] = (255, 255, 255, a)
    return out


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
