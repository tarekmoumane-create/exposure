"""
Builds every icon file for Exposure from one master. Run: python3 scripts/brand-assets.py

The icon, "the roll": a glossy red film canister with its strip curling out, each frame a different
look's colour. The master (assets/brand/icon-master.png, 2048px) is rendered artwork; this script
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
    """Android's themed icon: canister, cap and a band of film, in white on transparency."""
    s = size * SS
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    white = (255, 255, 255, 255)
    clear = (0, 0, 0, 0)
    bx0, bx1, by0, by1 = s * 0.30, s * 0.70, s * 0.24, s * 0.84
    d.rounded_rectangle([s * 0.43, s * 0.14, s * 0.57, s * 0.26], radius=s * 0.02, fill=white)  # cap
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=s * 0.05, fill=white)  # body
    # A band of film across the body, cut free of it by a clear gap, with sprocket holes.
    band0, band1 = s * 0.44, s * 0.66
    d.rectangle([s * 0.10, band0 - s * 0.025, s * 0.90, band1 + s * 0.025], fill=clear)
    d.rounded_rectangle([s * 0.10, band0, s * 0.90, band1], radius=s * 0.02, fill=white)
    hole = s * 0.03
    for i in range(10):
        x = s * 0.14 + i * s * 0.074
        for y in (band0 + s * 0.022, band1 - s * 0.022 - hole):
            d.rounded_rectangle([x, y, x + hole, y + hole], radius=hole * 0.25, fill=clear)
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
