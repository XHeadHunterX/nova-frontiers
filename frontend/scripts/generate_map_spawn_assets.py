from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "generated" / "map_spawns"
SIZE = 160


ORE_TYPES = {
    "titanium": ("Titanium Ore", (132, 153, 171), (211, 231, 239), (74, 91, 113)),
    "nickel_iron": ("Nickel-Iron Rock", (113, 121, 126), (204, 209, 209), (74, 78, 84)),
    "helium_3": ("Helium-3 Pocket", (72, 209, 240), (195, 252, 255), (40, 79, 123)),
    "iridium": ("Iridium Shards", (201, 169, 255), (255, 232, 255), (92, 68, 150)),
    "quantum_silicate": ("Quantum Silicate", (88, 238, 188), (218, 255, 236), (35, 106, 101)),
    "void_crystal": ("Void Crystal", (178, 92, 255), (238, 212, 255), (42, 30, 91)),
    "pocket_ore": ("Pocket-Rich Ore", (255, 196, 96), (255, 244, 188), (105, 55, 25)),
    # Future ore families.
    "cobalt_lattice": ("Cobalt Lattice", (75, 150, 255), (198, 228, 255), (31, 58, 128)),
    "osmium_black": ("Osmium Black", (64, 72, 92), (174, 190, 220), (20, 22, 34)),
    "vanadium_glass": ("Vanadium Glass", (118, 230, 133), (219, 255, 208), (44, 101, 68)),
    "neodymium_bloom": ("Neodymium Bloom", (255, 108, 196), (255, 222, 246), (112, 44, 106)),
    "plasma_ice": ("Plasma Ice", (107, 238, 255), (236, 255, 255), (46, 70, 134)),
    "stellar_gold": ("Stellar Gold", (255, 202, 72), (255, 244, 168), (121, 74, 21)),
    "dark_matter_ore": ("Dark Matter Ore", (95, 76, 150), (205, 183, 255), (15, 13, 35)),
    "bio_lattice": ("Bio-Lattice", (137, 255, 157), (234, 255, 211), (35, 96, 67)),
    "zero_point_ore": ("Zero Point Ore", (146, 245, 255), (255, 255, 255), (43, 38, 111)),
}


ANOMALY_TYPES = {
    "ancient_ruin": ("Ancient Ruin", (239, 203, 132), (255, 243, 201), (82, 59, 91)),
    "signal_echo": ("Signal Echo", (95, 220, 255), (219, 255, 255), (33, 57, 108)),
    "relic_vault": ("Relic Vault", (195, 119, 255), (247, 220, 255), (64, 42, 115)),
    "derelict_archive": ("Derelict Archive", (153, 178, 196), (231, 239, 244), (52, 67, 84)),
    "gravity_anomaly": ("Gravity Anomaly", (122, 98, 255), (232, 228, 255), (30, 25, 75)),
    "precursor_beacon": ("Precursor Beacon", (116, 255, 207), (228, 255, 239), (39, 89, 90)),
    "pocket_artifact": ("Pocket Artifact", (255, 207, 105), (255, 246, 190), (100, 59, 35)),
    # Future anomaly/site families.
    "wormhole": ("Wormhole", (86, 205, 255), (255, 255, 255), (72, 35, 149)),
    "temporal_rift": ("Temporal Rift", (255, 126, 219), (255, 232, 250), (74, 38, 116)),
    "alien_signal": ("Alien Signal", (137, 255, 114), (236, 255, 205), (39, 92, 66)),
    "plasma_storm": ("Plasma Storm", (255, 122, 82), (255, 229, 176), (100, 35, 57)),
    "data_cache": ("Data Cache", (110, 179, 255), (220, 240, 255), (35, 67, 122)),
    "quarantine_zone": ("Quarantine Zone", (207, 255, 83), (255, 255, 192), (73, 92, 35)),
    "psionic_mirror": ("Psionic Mirror", (207, 144, 255), (250, 228, 255), (65, 45, 120)),
}


EXTRA_TYPES = {
    "salvage": {
        "wreck": ((142, 155, 166), (233, 239, 243), (45, 56, 70)),
        "derelict_engine": ((255, 146, 88), (255, 226, 185), (80, 55, 55)),
        "cargo_pod": ((104, 196, 255), (216, 242, 255), (42, 72, 112)),
        "battle_debris": ((255, 95, 117), (255, 214, 222), (91, 39, 54)),
    },
    "cache": {
        "cargo_cache": ((92, 214, 176), (219, 255, 235), (34, 84, 72)),
        "smuggler_cache": ((190, 123, 255), (241, 219, 255), (59, 44, 107)),
        "medical_cache": ((255, 121, 144), (255, 225, 230), (90, 45, 58)),
        "fuel_cache": ((255, 194, 75), (255, 242, 184), (99, 67, 29)),
    },
    "hazard": {
        "radiation_cloud": ((191, 255, 82), (250, 255, 190), (59, 93, 35)),
        "minefield": ((255, 91, 68), (255, 218, 186), (96, 35, 35)),
        "ion_squall": ((87, 213, 255), (221, 255, 255), (35, 74, 118)),
        "void_wake": ((139, 102, 255), (229, 217, 255), (27, 22, 71)),
    },
}


def rgba(rgb, a=255):
    return (rgb[0], rgb[1], rgb[2], a)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def starfield(draw: ImageDraw.ImageDraw, rng: random.Random, tint, count: int, inset: int = 18):
    for _ in range(count):
        x = rng.randint(inset, SIZE - inset)
        y = rng.randint(inset, SIZE - inset)
        r = rng.choice([1, 1, 1, 2])
        alpha = rng.randint(55, 150)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(lerp((255, 255, 255), tint, 0.25), alpha))


def glow_layer(color, radius, blur):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    cx = cy = SIZE // 2
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=rgba(color, 55))
    return im.filter(ImageFilter.GaussianBlur(blur))


def draw_crystal_cluster(draw: ImageDraw.ImageDraw, rng: random.Random, center, radius, primary, light, dark, tier):
    cx, cy = center
    shard_count = 4 + tier * 2
    for idx in range(shard_count):
        angle = -math.pi / 2 + (idx - shard_count / 2) * (math.pi * 0.62 / max(1, shard_count - 1)) + rng.uniform(-0.16, 0.16)
        length = radius * rng.uniform(0.58, 1.05) * (1.12 if idx == shard_count // 2 else 1)
        width = radius * rng.uniform(0.13, 0.22)
        base = radius * rng.uniform(0.1, 0.32)
        bx = cx + math.cos(angle + math.pi / 2) * rng.uniform(-radius * 0.32, radius * 0.32)
        by = cy + rng.uniform(-radius * 0.08, radius * 0.22)
        tip = (bx + math.cos(angle) * length, by + math.sin(angle) * length)
        p1 = (bx + math.cos(angle + math.pi / 2) * width, by + math.sin(angle + math.pi / 2) * width)
        p2 = (bx + math.cos(angle - math.pi / 2) * width, by + math.sin(angle - math.pi / 2) * width)
        p3 = (bx - math.cos(angle) * base, by - math.sin(angle) * base)
        shade = lerp(primary, light, rng.uniform(0.12, 0.42))
        draw.polygon([tip, p1, p3, p2], fill=rgba(shade, 238), outline=rgba(dark, 210))
        mid = ((tip[0] + bx) / 2, (tip[1] + by) / 2)
        draw.line([tip, mid], fill=rgba(light, 130), width=max(1, tier // 2 + 1))
    base_poly = []
    for i in range(9):
        a = (math.tau * i / 9) + rng.uniform(-0.16, 0.16)
        rr = radius * rng.uniform(0.42, 0.68)
        base_poly.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.55 + radius * 0.24))
    draw.polygon(base_poly, fill=rgba(lerp(dark, primary, 0.35), 230), outline=rgba(light, 80))


def draw_ore_asset(path: Path, key: str, tier: int, colors):
    rng = random.Random(f"ore:{key}:{tier}")
    primary, light, dark = colors
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    im.alpha_composite(glow_layer(primary, 24 + tier * 7, 14 + tier * 2))
    d = ImageDraw.Draw(im, "RGBA")
    starfield(d, rng, primary, 10 + tier * 4)
    radius = 24 + tier * 7
    cx = SIZE // 2 + rng.randint(-3, 3)
    cy = SIZE // 2 + rng.randint(-1, 5)
    draw_crystal_cluster(d, rng, (cx, cy), radius, primary, light, dark, tier)
    for _ in range(28 + tier * 10):
        x = rng.gauss(cx, radius * 0.48)
        y = rng.gauss(cy, radius * 0.36)
        if (x - cx) ** 2 / (radius * 1.1) ** 2 + (y - cy) ** 2 / (radius * 0.72) ** 2 <= 1:
            r = rng.choice([1, 1, 2])
            d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(lerp(light, primary, rng.random()), rng.randint(35, 95)))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.1, percent=118, threshold=2))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def draw_orbit(draw: ImageDraw.ImageDraw, cx, cy, rx, ry, color, alpha, width=2, tilt=0.0):
    pts = []
    for i in range(96):
        a = math.tau * i / 96
        x = math.cos(a) * rx
        y = math.sin(a) * ry
        xt = x * math.cos(tilt) - y * math.sin(tilt)
        yt = x * math.sin(tilt) + y * math.cos(tilt)
        pts.append((cx + xt, cy + yt))
    draw.line(pts + [pts[0]], fill=rgba(color, alpha), width=width)


def draw_anomaly_asset(path: Path, key: str, tier: int, colors):
    rng = random.Random(f"anomaly:{key}:{tier}")
    primary, light, dark = colors
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    im.alpha_composite(glow_layer(primary, 26 + tier * 8, 18 + tier * 2))
    d = ImageDraw.Draw(im, "RGBA")
    starfield(d, rng, primary, 16 + tier * 5, 10)
    cx = SIZE // 2
    cy = SIZE // 2
    core = 9 + tier * 4
    for ring in range(5, 0, -1):
        rr = core + ring * (5 + tier)
        alpha = 20 + ring * 17
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=rgba(lerp(primary, light, ring / 5), alpha), width=2)
    for i in range(3 + tier):
        draw_orbit(d, cx, cy, 22 + tier * 6 + i * 4, 8 + tier * 2 + i * 2, lerp(primary, light, i / max(1, 2 + tier)), 80, 2, rng.uniform(-0.85, 0.85))
    for arm in range(3):
        pts = []
        phase = arm * math.tau / 3 + rng.uniform(-0.2, 0.2)
        for i in range(42):
            t = i / 41
            a = phase + t * (1.7 + tier * 0.15)
            r = core + t * (22 + tier * 7)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        d.line(pts, fill=rgba(primary, 72 + tier * 12), width=2 + tier // 2)
    d.ellipse((cx - core, cy - core, cx + core, cy + core), fill=rgba(light, 230), outline=rgba(primary, 210), width=2)
    d.ellipse((cx - core // 2, cy - core // 2, cx + core // 2, cy + core // 2), fill=rgba((255, 255, 255), 175))
    if any(term in key for term in ("ruin", "vault", "archive", "beacon", "cache", "artifact")):
        w = 24 + tier * 5
        h = 18 + tier * 4
        pts = [(cx, cy - h), (cx + w * 0.56, cy - h * 0.1), (cx + w * 0.38, cy + h), (cx - w * 0.42, cy + h * 0.88), (cx - w * 0.58, cy - h * 0.05)]
        d.polygon(pts, fill=rgba(lerp(dark, primary, 0.45), 172), outline=rgba(light, 135))
        d.line([(cx - w * 0.34, cy + h * 0.55), (cx + w * 0.34, cy - h * 0.55)], fill=rgba(light, 120), width=2)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=116, threshold=2))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def draw_extra_asset(path: Path, family: str, key: str, tier: int, colors):
    rng = random.Random(f"extra:{family}:{key}:{tier}")
    primary, light, dark = colors
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    im.alpha_composite(glow_layer(primary, 22 + tier * 6, 13 + tier * 2))
    d = ImageDraw.Draw(im, "RGBA")
    starfield(d, rng, primary, 9 + tier * 3)
    cx = cy = SIZE // 2
    radius = 20 + tier * 6
    if family == "salvage":
        for i in range(5 + tier):
            a = rng.uniform(0, math.tau)
            dist = rng.uniform(0, radius * 0.75)
            x = cx + math.cos(a) * dist
            y = cy + math.sin(a) * dist
            w = rng.uniform(radius * 0.28, radius * 0.56)
            h = rng.uniform(radius * 0.16, radius * 0.34)
            poly = [(x - w, y - h), (x + w * .7, y - h * .55), (x + w, y + h * .35), (x - w * .35, y + h)]
            d.polygon(poly, fill=rgba(lerp(dark, primary, rng.random() * .4), 220), outline=rgba(light, 94))
    elif family == "cache":
        w = radius * 1.35
        h = radius * 0.9
        d.rounded_rectangle((cx - w, cy - h, cx + w, cy + h), radius=8, fill=rgba(lerp(dark, primary, .42), 230), outline=rgba(light, 150), width=2)
        d.line((cx - w * .72, cy, cx + w * .72, cy), fill=rgba(light, 80), width=2)
        d.ellipse((cx - 6 - tier, cy - 6 - tier, cx + 6 + tier, cy + 6 + tier), fill=rgba(light, 170))
    else:
        for ring in range(4 + tier):
            rr = radius + ring * 4
            d.arc((cx - rr, cy - rr, cx + rr, cy + rr), rng.randint(0, 100), rng.randint(180, 330), fill=rgba(primary, 90), width=2)
        d.polygon([(cx, cy - radius), (cx + radius * .82, cy + radius * .5), (cx - radius * .82, cy + radius * .5)], fill=rgba(lerp(dark, primary, .5), 170), outline=rgba(light, 130))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=2))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def main():
    for key, (_, primary, light, dark) in ORE_TYPES.items():
        for tier in range(1, 7):
            draw_ore_asset(OUT / "ore" / f"{key}_t{tier}.png", key, tier, (primary, light, dark))
    for key, (_, primary, light, dark) in ANOMALY_TYPES.items():
        for tier in range(1, 7):
            draw_anomaly_asset(OUT / "anomaly" / f"{key}_t{tier}.png", key, tier, (primary, light, dark))
    for family, items in EXTRA_TYPES.items():
        for key, colors in items.items():
            for tier in range(1, 7):
                draw_extra_asset(OUT / family / f"{key}_t{tier}.png", family, key, tier, colors)


if __name__ == "__main__":
    main()
