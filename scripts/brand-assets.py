"""
Draws every icon file for Exposure. Run: python3 scripts/brand-assets.py

The icon, "last exposure": a tilted print on warm apricot light. In it, a cut-paper sunset (a
safelight-red sun sinking into an ink sea, its reflection laid in strokes) and a flash sparkle
catching the corner. The in-app LogoMark (src/components/logo-mark.tsx) is the same idea at
wordmark size: a sun behind a frame.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
SS = 2

PAPER = (243, 238, 230)
PRINT = (255, 253, 248)
INK = (29, 26, 23)
RED = (196, 70, 43)
SKY_TOP = (246, 168, 124)
SKY_LOW = (250, 214, 168)
BG_TOP = (252, 228, 208)
BG_LOW = (241, 178, 150)


def vertical_gradient(w, h, top, low):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(round(top[i] + (low[i] - top[i]) * t) for i in range(3)))
    return g.resize((w, h))


def sparkle(draw, cx, cy, r, fill):
    """A four-point flash star: long points on the axes, concave sides between them."""
    pts = []
    for i in range(240):
        t = i / 240 * 2 * math.pi
        c, n = math.cos(t), math.sin(t)
        pts.append((cx + r * math.copysign(abs(c) ** 4, c), cy + r * math.copysign(abs(n) ** 4, n)))
    draw.polygon(pts, fill=fill)


def print_layer(size, mono=False):
    """The print itself, unrotated, on a transparent square of the given size."""
    s = size
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    w, h = int(s * 0.6), int(s * 0.7)
    x0, y0 = (s - w) // 2 - int(s * 0.03), (s - h) // 2 + int(s * 0.03)
    d = ImageDraw.Draw(layer)
    paper = (255, 255, 255, 255) if mono else PRINT + (255,)
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=int(s * 0.018), fill=paper)
    # Photo window: even borders on three sides, a deeper one at the bottom, like an instant print.
    b = int(w * 0.075)
    px0, py0, px1 = x0 + b, y0 + b, x0 + w - b
    py1 = py0 + (px1 - px0)  # square photo
    pw, ph = px1 - px0, py1 - py0
    photo = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
    if mono:
        pd = ImageDraw.Draw(photo)
        horizon = int(ph * 0.66)
        sun_r = int(pw * 0.22)
        cx = pw // 2
        pd.ellipse([cx - sun_r, horizon - sun_r, cx + sun_r, horizon + sun_r], fill=(255, 255, 255, 255))
        pd.rectangle([0, horizon, pw, ph], fill=(255, 255, 255, 255))
        layer.paste(photo, (px0, py0), photo)
        # Cut the photo window out of the white card so the mark reads as a silhouette.
        hole = Image.new('L', (s, s), 0)
        ImageDraw.Draw(hole).rectangle([px0, py0, px1, py1], fill=255)
        window = Image.new('L', (s, s), 0)
        window.paste(photo.getchannel('A'), (px0, py0))
        alpha = layer.getchannel('A')
        alpha.paste(0, mask=hole)
        alpha.paste(255, mask=window)
        layer.putalpha(alpha)
        return layer
    sky = vertical_gradient(pw, ph, SKY_TOP, SKY_LOW).convert('RGBA')
    photo.paste(sky, (0, 0))
    pd = ImageDraw.Draw(photo)
    horizon = int(ph * 0.66)
    sun_r = int(pw * 0.22)
    cx = pw // 2
    pd.ellipse([cx - sun_r, horizon - sun_r, cx + sun_r, horizon + sun_r], fill=RED + (255,))
    pd.rectangle([0, horizon, pw, ph], fill=INK + (255,))
    # The sun's reflection, cut as strokes that narrow toward the viewer.
    stroke_h = max(2, int(ph * 0.035))
    for i, frac in enumerate([0.8, 0.55, 0.32]):
        half = sun_r * frac
        y = horizon + int(ph * 0.055) + i * int(stroke_h * 2.2)
        pd.rounded_rectangle([cx - half, y, cx + half, y + stroke_h], radius=stroke_h // 2, fill=RED + (255,))
    layer.paste(photo, (px0, py0))
    return layer


def icon_art(size, background=True, rotate=-7, with_sparkle=True, mono=False):
    s = size * SS
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    if background:
        im.paste(vertical_gradient(s, s, BG_TOP, BG_LOW).convert('RGBA'), (0, 0))
    card = print_layer(s, mono=mono).rotate(rotate, resample=Image.BICUBIC)
    if not mono:
        shadow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        shadow_alpha = card.getchannel('A').point(lambda a: int(a * 0.32))
        shadow.putalpha(shadow_alpha)
        shadow = Image.composite(Image.new('RGBA', (s, s), (90, 45, 25, 255)), shadow, shadow_alpha)
        shadow = shadow.filter(ImageFilter.GaussianBlur(s * 0.03))
        im.alpha_composite(shadow, (int(s * 0.012), int(s * 0.03)))
    im.alpha_composite(card)
    if with_sparkle:
        white = (255, 255, 255, 255)
        if background and not mono:
            # A soft bloom first, so the flash glows against the warm light.
            bloom = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            ImageDraw.Draw(bloom).ellipse([s * 0.70, s * 0.03, s * 0.94, s * 0.27], fill=(255, 250, 240, 170))
            im.alpha_composite(bloom.filter(ImageFilter.GaussianBlur(s * 0.035)))
        d = ImageDraw.Draw(im)
        sparkle(d, s * 0.82, s * 0.15, s * 0.11, white)
        sparkle(d, s * 0.925, s * 0.30, s * 0.04, white)
    return im.resize((size, size), Image.LANCZOS)


def fit(art, size, scale):
    """Places art scaled down inside a transparent square (for safe zones)."""
    inner = int(size * scale)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(art.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return out


def save(im, name):
    im.save(os.path.join(OUT, name))
    print('wrote', name, im.size)


save(icon_art(1024).convert('RGB'), 'icon.png')
save(fit(icon_art(1024, background=False), 512, 0.8), 'splash-icon.png')
save(vertical_gradient(1024, 1024, BG_TOP, BG_LOW).convert('RGBA'), 'android-icon-background.png')
save(fit(icon_art(1024, background=False), 1024, 0.72), 'android-icon-foreground.png')
save(fit(icon_art(1024, background=False, mono=True), 1024, 0.72), 'android-icon-monochrome.png')
save(icon_art(64).convert('RGB'), 'favicon.png')
