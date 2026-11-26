#!/usr/bin/env python3
"""
High-Density 28x28 Original 3D-Screw Pixel Art Generator for Screw Jam.
Generates 12 original kawaii/overseas artworks, each producing:
  1. assets/resources/paint/art_<id>_finish.png  (448x448 pre-rendered with real 3D Scheme-A screws)
  2. assets/resources/paint/art_<id>_outline.png (448x448 clean dashed outer contour like original xiankuang)
  3. assets/resources/config/art_manifest.json   (row-sorted [col, row, colorId] coordinates)
"""
import json
import math
import os
from PIL import Image, ImageDraw

ROOT = "/Users/echo/workspace/CocosGames/ScrewOut"
GAMES_DIR = os.path.join(ROOT, "assets/resources/sprites/games")
PAINT_DIR = os.path.join(ROOT, "assets/resources/paint")
CONFIG_DIR = os.path.join(ROOT, "assets/resources/config")

GRID = 28
CELL_PX = 16
CANVAS_PX = GRID * CELL_PX  # 448x448

# Scheme A (Royal Candy) canonical RGBs for nearest-color quantization
PALETTE_RGB = {
    1:  (228, 34, 42),    # Red
    2:  (250, 214, 34),   # Yellow
    3:  (36, 186, 68),    # Green
    4:  (38, 102, 232),   # Blue
    5:  (156, 62, 236),   # Purple
    6:  (248, 134, 28),   # Orange
    7:  (248, 128, 188),  # Pink
    8:  (46, 208, 234),   # Cyan
    9:  (246, 248, 252),  # Pearl White
    10: (38, 42, 52),     # Black
}

C = {k: (*v, 255) for k, v in PALETTE_RGB.items()}


def nearest_color_id(r: int, g: int, b: int) -> int:
    best_id = 10
    best_d = 10**9
    for cid, (pr, pg, pb) in PALETTE_RGB.items():
        # Perceptual weighted distance
        d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2
        if d < best_d:
            best_d = d
            best_id = cid
    return best_id


def draw_kawaii_eyes(d: ImageDraw.ImageDraw, cx: int, cy: int, dx: int, r: int = 12, cheek_y: int = 18):
    # Cute dark eyes + white specular sparkle + pink cheeks
    for sx in (-1, 1):
        ex = cx + sx * dx
        d.ellipse([ex - r, cy - r, ex + r, cy + r], fill=C[10])
        d.ellipse([ex - r // 2, cy - r // 2 - 2, ex - r // 2 + 6, cy - r // 2 + 4], fill=C[9])
        # Rosy cheek
        d.ellipse([ex + sx * 10 - 12, cy + cheek_y - 8, ex + sx * 10 + 12, cy + cheek_y + 8], fill=C[7])


def render_art_vector(art_id: str) -> Image.Image:
    """Draw a clean, bold, charming kawaii illustration on a 280x280 RGBA canvas."""
    S = 280
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if art_id == "lucky_cat":
        # Cute Kuromi/Kitty style cat with pointy ears, pink inner ears, white face, red collar, gold bell
        # Ears (outer black + inner pink)
        d.polygon([(46, 118), (64, 24), (126, 74)], fill=C[10])
        d.polygon([(62, 102), (72, 46), (108, 78)], fill=C[7])
        d.polygon([(234, 118), (216, 24), (154, 74)], fill=C[10])
        d.polygon([(218, 102), (208, 46), (172, 78)], fill=C[7])
        # Head outline & warm pearl-white face
        d.ellipse([44, 60, 236, 206], fill=C[9], outline=C[10], width=10)
        # Cute pink hood/bangs accent at top
        d.chord([54, 66, 226, 136], start=180, end=360, fill=C[7])
        d.ellipse([126, 74, 154, 102], fill=C[2], outline=C[10], width=4)
        # Body
        d.rounded_rectangle([76, 186, 204, 260], radius=34, fill=C[9], outline=C[10], width=10)
        # Red collar + golden bell
        d.rounded_rectangle([78, 184, 202, 206], radius=10, fill=C[1], outline=C[10], width=4)
        d.ellipse([124, 194, 156, 226], fill=C[2], outline=C[10], width=5)
        draw_kawaii_eyes(d, 140, 140, 38, r=12, cheek_y=20)
        # Cute little pink nose
        d.ellipse([132, 148, 148, 160], fill=C[7])

    elif art_id == "cute_panda":
        # Round black ears
        d.ellipse([36, 30, 108, 102], fill=C[10])
        d.ellipse([172, 30, 244, 102], fill=C[10])
        # White round head
        d.ellipse([40, 56, 240, 226], fill=C[9], outline=C[10], width=10)
        # Classic black eye patches
        d.ellipse([66, 106, 124, 166], fill=C[10])
        d.ellipse([156, 106, 214, 166], fill=C[10])
        # Sparkling white eyes inside patches
        d.ellipse([86, 122, 106, 142], fill=C[9])
        d.ellipse([174, 122, 194, 142], fill=C[9])
        # Rosy cheeks & cute nose
        d.ellipse([58, 162, 86, 182], fill=C[7])
        d.ellipse([194, 162, 222, 182], fill=C[7])
        d.ellipse([126, 158, 154, 176], fill=C[10])
        # Green bamboo leaf on top!
        d.ellipse([116, 24, 164, 58], fill=C[3], outline=C[10], width=6)
        # Cute paws at bottom
        d.ellipse([64, 210, 124, 258], fill=C[10])
        d.ellipse([156, 210, 216, 258], fill=C[10])

    elif art_id == "happy_corgi":
        # Tall perky orange corgi ears
        d.polygon([(44, 124), (48, 22), (118, 74)], fill=C[6], outline=C[10])
        d.polygon([(60, 108), (64, 48), (102, 80)], fill=C[7])
        d.polygon([(236, 124), (232, 22), (162, 74)], fill=C[6], outline=C[10])
        d.polygon([(220, 108), (216, 48), (178, 80)], fill=C[7])
        # Orange fluffy head
        d.ellipse([38, 66, 242, 232], fill=C[6], outline=C[10], width=10)
        # White muzzle & blaze stripe
        d.ellipse([76, 134, 204, 230], fill=C[9])
        d.rounded_rectangle([122, 72, 158, 160], radius=16, fill=C[9])
        draw_kawaii_eyes(d, 140, 136, 42, r=12, cheek_y=24)
        # Nose & happy pink tongue
        d.ellipse([126, 154, 154, 174], fill=C[10])
        d.rounded_rectangle([126, 176, 154, 212], radius=14, fill=C[7], outline=C[10], width=4)
        # Blue collar
        d.rounded_rectangle([84, 226, 196, 254], radius=12, fill=C[4], outline=C[10], width=6)

    elif art_id == "strawberry_cake":
        # Golden cupcake wrapper trapezoid
        d.polygon([(66, 156), (214, 156), (192, 254), (88, 254)], fill=C[6], outline=C[10])
        # Wrapper vertical ridges
        for rx in (106, 140, 174):
            d.line([(rx, 162), (rx, 248)], fill=C[2], width=8)
        # Fluffy pink frosting layers
        d.ellipse([42, 106, 238, 182], fill=C[7], outline=C[10], width=9)
        d.ellipse([62, 68, 218, 146], fill=C[7], outline=C[10], width=9)
        # Bright red strawberry on top with green leaves
        d.ellipse([112, 24, 168, 84], fill=C[1], outline=C[10], width=7)
        d.polygon([(116, 30), (140, 14), (164, 30)], fill=C[3])
        # Colorful sprinkles
        for (sx, sy, col) in [(82, 132, 2), (116, 104, 8), (164, 108, 2), (194, 134, 8), (140, 138, 9)]:
            d.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=C[col])

    elif art_id == "space_rocket":
        # Fiery orange/yellow exhaust flame
        d.polygon([(104, 206), (176, 206), (140, 266)], fill=C[6])
        d.polygon([(118, 206), (162, 206), (140, 248)], fill=C[2])
        # Crimson side fins
        d.polygon([(88, 150), (34, 220), (96, 212)], fill=C[1], outline=C[10])
        d.polygon([(192, 150), (246, 220), (184, 212)], fill=C[1], outline=C[10])
        # Pearl-white rocket hull
        d.ellipse([82, 26, 198, 222], fill=C[9], outline=C[10], width=10)
        # Red nose cone
        d.chord([84, 26, 196, 128], start=180, end=360, fill=C[1], outline=C[10], width=8)
        # Blue-rimmed cyan porthole window
        d.ellipse([104, 104, 176, 176], fill=C[4], outline=C[10], width=6)
        d.ellipse([116, 116, 164, 164], fill=C[8])
        d.ellipse([124, 124, 138, 138], fill=C[9])

    elif art_id == "royal_crown":
        # Golden 3-peak royal crown
        d.polygon([
            (36, 212), (26, 86), (92, 136), (140, 52),
            (188, 136), (254, 86), (244, 212)
        ], fill=C[2], outline=C[10])
        # Red velvet base band
        d.rounded_rectangle([38, 184, 242, 224], radius=14, fill=C[1], outline=C[10], width=8)
        # Top golden orbs
        for (ox, oy) in [(28, 76), (140, 44), (252, 76)]:
            d.ellipse([ox - 16, oy - 16, ox + 16, oy + 16], fill=C[2], outline=C[10], width=6)
        # Sparkling center gems
        d.ellipse([120, 126, 160, 166], fill=C[8], outline=C[10], width=6)
        d.ellipse([66, 144, 98, 176], fill=C[5], outline=C[10], width=5)
        d.ellipse([182, 144, 214, 176], fill=C[3], outline=C[10], width=5)

    elif art_id == "sweet_donut":
        # Golden dough ring
        d.ellipse([28, 28, 252, 252], fill=C[6], outline=C[10], width=10)
        # Glossy pink strawberry icing
        d.ellipse([38, 36, 242, 230], fill=C[7])
        # Center donut hole (transparent!)
        d.ellipse([104, 104, 176, 176], fill=(0, 0, 0, 0), outline=C[10], width=9)
        # Vibrant sprinkles
        for (sx, sy, col) in [(88, 76, 2), (144, 62, 8), (196, 84, 9), (206, 148, 2), (186, 198, 3), (96, 198, 8), (68, 142, 9)]:
            d.rounded_rectangle([sx - 10, sy - 6, sx + 10, sy + 6], radius=4, fill=C[col])

    elif art_id == "cute_penguin":
        # Chubby black-blue penguin body
        d.ellipse([48, 34, 232, 246], fill=C[10])
        # Cute flippers
        d.ellipse([24, 120, 74, 200], fill=C[10])
        d.ellipse([206, 120, 256, 200], fill=C[10])
        # White heart-shaped face & belly
        d.ellipse([76, 70, 204, 234], fill=C[9])
        # Cozy red scarf
        d.rounded_rectangle([68, 144, 212, 174], radius=12, fill=C[1], outline=C[10], width=5)
        d.rounded_rectangle([156, 160, 186, 214], radius=10, fill=C[1], outline=C[10], width=5)
        draw_kawaii_eyes(d, 140, 106, 32, r=11, cheek_y=18)
        # Golden beak & feet
        d.polygon([(124, 118), (156, 118), (140, 140)], fill=C[2], outline=C[10])
        d.ellipse([72, 224, 128, 258], fill=C[6], outline=C[10], width=6)
        d.ellipse([152, 224, 208, 258], fill=C[6], outline=C[10], width=6)

    elif art_id == "cozy_avocado":
        # Pear-shaped green avocado
        d.ellipse([66, 28, 214, 160], fill=C[3], outline=C[10], width=10)
        d.ellipse([46, 94, 234, 256], fill=C[3], outline=C[10], width=10)
        # Soft yellow-green inner flesh
        d.ellipse([80, 44, 200, 152], fill=C[2])
        d.ellipse([62, 106, 218, 240], fill=C[2])
        # Warm orange-brown pit
        d.ellipse([96, 146, 184, 228], fill=C[6], outline=C[10], width=8)
        d.ellipse([112, 160, 134, 182], fill=C[9])
        draw_kawaii_eyes(d, 140, 108, 28, r=10, cheek_y=16)

    elif art_id == "baby_dino":
        # Orange back spikes
        for (sx, sy) in [(178, 52), (206, 86), (218, 128), (222, 170)]:
            d.ellipse([sx - 18, sy - 16, sx + 18, sy + 16], fill=C[6], outline=C[10], width=6)
        # Emerald body & tail
        d.ellipse([56, 114, 218, 246], fill=C[3], outline=C[10], width=10)
        d.polygon([(180, 180), (254, 212), (186, 236)], fill=C[3], outline=C[10])
        # Cute big emerald head
        d.ellipse([44, 38, 196, 154], fill=C[3], outline=C[10], width=10)
        # Sunny yellow belly
        d.ellipse([72, 156, 158, 236], fill=C[2])
        draw_kawaii_eyes(d, 106, 90, 28, r=11, cheek_y=18)

    elif art_id == "rainbow_cloud":
        # Vibrant 4-band rainbow arch
        for rad, col in [(116, 1), (98, 6), (80, 2), (62, 8)]:
            d.pieslice([140 - rad, 174 - rad, 140 + rad, 174 + rad], start=180, end=360, fill=C[col])
        d.pieslice([140 - 44, 174 - 44, 140 + 44, 174 + 44], start=180, end=360, fill=(0, 0, 0, 0))
        # Fluffy pearl-white cloud at bottom
        d.ellipse([32, 146, 128, 236], fill=C[9], outline=C[10], width=9)
        d.ellipse([152, 146, 248, 236], fill=C[9], outline=C[10], width=9)
        d.ellipse([78, 116, 202, 236], fill=C[9], outline=C[10], width=9)
        d.rectangle([74, 162, 206, 228], fill=C[9])
        draw_kawaii_eyes(d, 140, 178, 34, r=10, cheek_y=16)

    else:  # cozy_cottage
        # Chimney
        d.rectangle([182, 42, 216, 112], fill=C[6], outline=C[10], width=7)
        # Crimson roof triangle
        d.polygon([(26, 136), (140, 34), (254, 136)], fill=C[1], outline=C[10])
        # Warm yellow house walls
        d.rounded_rectangle([54, 130, 226, 240], radius=10, fill=C[2], outline=C[10], width=9)
        # Cyan window & orange door
        d.rounded_rectangle([74, 152, 126, 198], radius=8, fill=C[8], outline=C[10], width=6)
        d.rounded_rectangle([148, 160, 204, 236], radius=10, fill=C[6], outline=C[10], width=6)
        d.ellipse([184, 196, 196, 208], fill=C[2])
        # Green garden lawn strip
        d.rounded_rectangle([26, 232, 254, 258], radius=12, fill=C[3], outline=C[10], width=6)

    return im


def generate_all():
    os.makedirs(PAINT_DIR, exist_ok=True)
    os.makedirs(CONFIG_DIR, exist_ok=True)

    # Load actual Scheme-A 3D screws resized to CELL_PX x CELL_PX
    screw_sprites = {}
    for cid in range(1, 11):
        sp = Image.open(os.path.join(GAMES_DIR, f"gbz_screw{cid}.png")).convert("RGBA")
        screw_sprites[cid] = sp.resize((CELL_PX, CELL_PX), Image.Resampling.LANCZOS)

    art_specs = [
        ("lucky_cat", "Lucky Cat"),
        ("cute_panda", "Bamboo Panda"),
        ("happy_corgi", "Happy Corgi"),
        ("strawberry_cake", "Berry Cupcake"),
        ("space_rocket", "Star Rocket"),
        ("royal_crown", "Royal Crown"),
        ("sweet_donut", "Glazed Donut"),
        ("cute_penguin", "Chilly Penguin"),
        ("cozy_avocado", "Happy Avocado"),
        ("baby_dino", "Baby Dino"),
        ("rainbow_cloud", "Rainbow Cloud"),
        ("cozy_cottage", "Dream Cottage"),
    ]

    manifest = []
    for art_id, title in art_specs:
        vec = render_art_vector(art_id)
        # Sample with NEAREST so crisp black/white borders never blend into stray mid-tone colors!
        small = vec.resize((GRID, GRID), Image.Resampling.NEAREST)
        spx = small.load()

        occ = [[0] * GRID for _ in range(GRID)]
        cells = []
        finish_im = Image.new("RGBA", (CANVAS_PX, CANVAS_PX), (0, 0, 0, 0))

        for r in range(GRID):
            for c in range(GRID):
                rv, gv, bv, av = spx[c, r]
                if av >= 115:
                    cid = nearest_color_id(rv, gv, bv)
                    occ[r][c] = cid
                    cells.append([c, r, cid])
                    finish_im.alpha_composite(screw_sprites[cid], (c * CELL_PX, r * CELL_PX))

        # Generate crisp dashed outer contour outline (like original xiankuang!)
        outline_im = Image.new("RGBA", (CANVAS_PX, CANVAS_PX), (0, 0, 0, 0))
        od = ImageDraw.Draw(outline_im)
        dash_color = (100, 116, 139, 195)
        for r in range(GRID):
            for c in range(GRID):
                if occ[r][c] == 0:
                    continue
                x0, y0 = c * CELL_PX, r * CELL_PX
                x1, y1 = x0 + CELL_PX, y0 + CELL_PX
                # Draw subtle dashed edge on boundary sides facing empty space
                if r == 0 or occ[r - 1][c] == 0:
                    od.line([(x0 + 2, y0), (x1 - 2, y0)], fill=dash_color, width=3)
                if r == GRID - 1 or occ[r + 1][c] == 0:
                    od.line([(x0 + 2, y1), (x1 - 2, y1)], fill=dash_color, width=3)
                if c == 0 or occ[r][c - 1] == 0:
                    od.line([(x0, y0 + 2), (x0, y1 - 2)], fill=dash_color, width=3)
                if c == GRID - 1 or occ[r][c + 1] == 0:
                    od.line([(x1, y0 + 2), (x1, y1 - 2)], fill=dash_color, width=3)

        finish_im.save(os.path.join(PAINT_DIR, f"art_{art_id}_finish.png"))
        outline_im.save(os.path.join(PAINT_DIR, f"art_{art_id}_outline.png"))

        manifest.append({
            "id": art_id,
            "title": title,
            "gridSize": GRID,
            "total": len(cells),
            "cells": cells,
        })
        print(f"  {art_id:16s} -> {len(cells):3d} screws (28x28)")

    with open(os.path.join(CONFIG_DIR, "art_manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    print(f"Generated {len(manifest)} HD 28x28 3D-screw artworks in {PAINT_DIR}")


if __name__ == "__main__":
    generate_all()
