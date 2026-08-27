#!/usr/bin/env python3
"""Generate the PWA icon set for program-generator.html.

Design: barbell mark on the app's near-black panel colour, plates tinted with the
Build / Develop / Peak accents used throughout the app. Rendered at 4x then
downsampled so the edges stay clean at small sizes.
"""
from PIL import Image, ImageDraw

BG_TOP   = (0x1E, 0x22, 0x2B)   # --panel-2
BG_BOT   = (0x0E, 0x10, 0x14)   # --bg
BAR      = (0xE8, 0xEA, 0xED)   # --ink
PLATE_IN = (0xE0, 0x53, 0x3E)   # --peak
PLATE_MID= (0xE0, 0xA3, 0x3E)   # --develop
PLATE_OUT= (0x4C, 0x7B, 0xD9)   # --build

SS = 4  # supersample factor


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        d.point((0, y), fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((size, size), Image.NEAREST)


def rounded(d, cx, cy, w, h, fill, r=None):
    """Rounded rect centred on (cx, cy)."""
    if r is None:
        r = min(w, h) * 0.32
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
                        radius=r, fill=fill)


def barbell(size, glyph_scale=1.0, corner_radius=None):
    S = size * SS
    img = vertical_gradient(S, BG_TOP, BG_BOT).convert("RGBA")
    d = ImageDraw.Draw(img)

    cx = cy = S / 2
    g = S * glyph_scale

    # centre bar
    rounded(d, cx, cy, g * 0.74, g * 0.052, BAR, r=g * 0.026)

    # plates, mirrored: inner (tall) -> outer (short)
    plates = [
        (0.205, 0.080, 0.400, PLATE_IN),
        (0.283, 0.066, 0.300, PLATE_MID),
        (0.348, 0.054, 0.210, PLATE_OUT),
    ]
    for dx, pw, ph, col in plates:
        for sign in (-1, 1):
            rounded(d, cx + sign * g * dx, cy, g * pw, g * ph, col, r=g * pw * 0.30)

    # sleeve caps at each end of the bar
    for sign in (-1, 1):
        rounded(d, cx + sign * g * 0.385, cy, g * 0.030, g * 0.105, BAR, r=g * 0.014)

    if corner_radius:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1],
                                              radius=int(S * corner_radius), fill=255)
        img.putalpha(mask)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    # Manifest icons, purpose "any" — slight rounding for surfaces that don't mask.
    barbell(192, glyph_scale=0.92, corner_radius=0.18).save("icons/icon-192.png")
    barbell(512, glyph_scale=0.92, corner_radius=0.18).save("icons/icon-512.png")

    # Maskable — glyph inside the centre 80% safe zone, full-bleed background.
    barbell(512, glyph_scale=0.70).convert("RGB").save("icons/icon-512-maskable.png")

    # iOS applies its own squircle mask: full bleed, no transparency.
    barbell(180, glyph_scale=0.92).convert("RGB").save("icons/apple-touch-icon.png")

    print("icons written")
