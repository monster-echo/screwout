#!/usr/bin/env python3
"""
Generate 100% original commercial-ready overseas casual art assets for ScrewOut.
Style: Glossy Candy-Workshop & Frosted Acrylic (supersampled 2x anti-aliased).
Replaces all sprites in assets/resources/sprites/{games,boards,ui,ui_orig} and spine/touch/touch.png.
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path("/Users/echo/workspace/CocosGames/ScrewOut/assets/resources")
GAMES_DIR = ROOT / "sprites/games"
BOARDS_DIR = ROOT / "sprites/boards"
UI_DIR = ROOT / "sprites/ui"
UI_ORIG_DIR = ROOT / "sprites/ui_orig"
TOUCH_PNG = ROOT / "spine/touch/touch.png"

# 10 vibrant, high-contrast colorblind-friendly screw/box colors
PALETTE = {
    1: ((239, 68, 68), (185, 28, 28), (254, 165, 165)),     # Ruby Red
    2: ((249, 115, 22), (194, 65, 12), (253, 186, 116)),    # Tangerine Orange
    3: ((250, 204, 21), (202, 138, 4), (254, 240, 138)),    # Lemon Yellow
    4: ((34, 197, 94), (21, 128, 61), (134, 239, 172)),     # Emerald Green
    5: ((6, 182, 212), (14, 116, 144), (165, 243, 252)),    # Aqua Cyan
    6: ((59, 130, 246), (29, 78, 216), (147, 197, 253)),    # Cobalt Blue
    7: ((168, 85, 247), (126, 34, 206), (216, 180, 254)),   # Amethyst Purple
    8: ((236, 72, 153), (190, 24, 93), (249, 168, 212)),    # Berry Pink
    9: ((161, 98, 7), (113, 63, 18), (217, 160, 91)),       # Caramel Bronze
    10: ((100, 116, 139), (51, 65, 85), (203, 213, 225)),   # Titanium Slate
    11: ((20, 184, 166), (15, 118, 110), (153, 246, 228)),  # Mint Teal
}


def draw_screw(color_id: int, size=110) -> Image.Image:
    S = size * 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base, dark, light = PALETTE.get(color_id, PALETTE[1])
    pad = int(S * 0.06)
    cx, cy = S // 2, S // 2
    r = S // 2 - pad

    # Drop shadow
    d.ellipse([cx - r, cy - r + 8, cx + r, cy + r + 8], fill=(15, 23, 42, 70))
    # Outer dark metallic rim
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dark)
    # Main colored dome
    r2 = int(r * 0.88)
    d.ellipse([cx - r2, cy - r2 - 2, cx + r2, cy + r2 - 2], fill=base)
    # Top-left glossy highlight arc
    r3 = int(r * 0.72)
    d.ellipse([cx - r3, cy - r3 - 6, cx + r3, cy + r3 - 18], fill=light + (115,))
    # Inner bright specular dot
    d.ellipse([cx - int(r * 0.45), cy - int(r * 0.52), cx - int(r * 0.15), cy - int(r * 0.28)], fill=(255, 255, 255, 165))

    # Recessed Phillips cross slot
    arm = int(r * 0.50)
    thick = int(r * 0.20)
    slot_col = (max(0, dark[0] - 40), max(0, dark[1] - 40), max(0, dark[2] - 40), 255)
    # Cross shadow bevel
    d.rounded_rectangle([cx - arm, cy - thick // 2 + 3, cx + arm, cy + thick // 2 + 3], radius=thick // 2, fill=(255, 255, 255, 90))
    d.rounded_rectangle([cx - thick // 2, cy - arm + 3, cx + thick // 2, cy + arm + 3], radius=thick // 2, fill=(255, 255, 255, 90))
    # Cross recess
    d.rounded_rectangle([cx - arm, cy - thick // 2, cx + arm, cy + thick // 2], radius=thick // 2, fill=slot_col)
    d.rounded_rectangle([cx - thick // 2, cy - arm, cx + thick // 2, cy + arm], radius=thick // 2, fill=slot_col)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def draw_toolbox(color_id: int, w=260, h=343) -> Image.Image:
    W, H = w * 2, h * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base, dark, light = PALETTE.get(color_id, ((148, 163, 184), (71, 85, 105), (226, 232, 240)))

    # Top metallic handle
    d.rounded_rectangle([W * 0.28, 18, W * 0.72, 100], radius=24, fill=dark)
    d.rounded_rectangle([W * 0.31, 24, W * 0.69, 86], radius=18, fill=base)
    d.rounded_rectangle([W * 0.37, 50, W * 0.63, 98], radius=10, fill=(0, 0, 0, 0))

    # Main box drop shadow + 3D bottom lip
    d.rounded_rectangle([24, 96, W - 24, H - 14], radius=44, fill=(15, 23, 42, 45))
    d.rounded_rectangle([20, 86, W - 20, H - 24], radius=44, fill=dark)
    # Front colored shell
    d.rounded_rectangle([20, 74, W - 20, H - 72], radius=44, fill=base)
    # Top edge gloss
    d.rounded_rectangle([32, 82, W - 32, 130], radius=24, fill=light + (130,))

    # Inner clean pearl-white tray
    d.rounded_rectangle([46, 128, W - 46, H - 102], radius=28, fill=(241, 245, 249, 255), outline=dark, width=6)

    # 3 recessed screw sockets (matching TargetBox triangle positions: (0,+14), (-35,-34), (+35,-34) at 156x204 -> scaled to 520x686)
    scale_x = W / 156.0
    scale_y = H / 204.0
    holes = [(0, 14), (-35, -34), (35, -34)]
    hr = 46
    for hx, hy in holes:
        px = W / 2 + hx * scale_x
        py = H / 2 - hy * scale_y
        d.ellipse([px - hr - 4, py - hr - 4, px + hr + 4, py + hr + 4], fill=(203, 213, 225, 255))
        d.ellipse([px - hr, py - hr, px + hr, py + hr], fill=(100, 116, 139, 255))
        d.ellipse([px - hr + 6, py - hr + 10, px + hr - 6, py + hr - 2], fill=(71, 85, 105, 255))

    return img.resize((w, h), Image.Resampling.LANCZOS)


def draw_cover(color_id: int, w=260, h=282) -> Image.Image:
    W, H = w * 2, h * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base, dark, light = PALETTE.get(color_id, PALETTE[1])

    # Snug 3D snap-on lid
    d.rounded_rectangle([18, 40, W - 18, H - 24], radius=44, fill=dark)
    d.rounded_rectangle([18, 28, W - 18, H - 56], radius=44, fill=base)
    d.rounded_rectangle([38, 44, W - 38, 120], radius=24, fill=light + (140,))
    # Center latch clasp
    d.rounded_rectangle([W * 0.36, H - 96, W * 0.64, H - 16], radius=16, fill=(250, 204, 21, 255), outline=(161, 98, 7, 255), width=6)
    return img.resize((w, h), Image.Resampling.LANCZOS)


def draw_locked_box(w=177, h=230) -> Image.Image:
    W, H = w * 2, h * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Frosted teal-mint locked crate with golden padlock
    d.rounded_rectangle([W * 0.28, 12, W * 0.72, 68], radius=18, fill=(13, 148, 136, 255))
    d.rounded_rectangle([14, 52, W - 14, H - 14], radius=34, fill=(15, 118, 110, 255))
    d.rounded_rectangle([14, 42, W - 14, H - 38], radius=34, fill=(45, 212, 191, 255))
    d.rounded_rectangle([26, 52, W - 26, 94], radius=18, fill=(153, 246, 228, 150))

    # Golden padlock in center
    cx, cy = W // 2, H // 2 + 12
    # Shackle
    d.arc([cx - 46, cy - 92, cx + 46, cy + 4], 180, 360, fill=(254, 240, 138, 255), width=16)
    # Lock body
    d.rounded_rectangle([cx - 60, cy - 38, cx + 60, cy + 56], radius=20, fill=(217, 119, 6, 255))
    d.rounded_rectangle([cx - 60, cy - 46, cx + 60, cy + 46], radius=20, fill=(250, 204, 21, 255))
    # Keyhole
    d.ellipse([cx - 14, cy - 16, cx + 14, cy + 12], fill=(120, 53, 15, 255))
    d.polygon([(cx - 8, cy + 4), (cx + 8, cy + 4), (cx + 12, cy + 30), (cx - 12, cy + 30)], fill=(120, 53, 15, 255))
    # Small "+BOX" plus badge at top right
    d.ellipse([W - 92, 54, W - 24, 122], fill=(34, 197, 94, 255), outline=(255, 255, 255, 255), width=6)
    d.rounded_rectangle([W - 76, 82, W - 40, 94], radius=4, fill=(255, 255, 255, 255))
    d.rounded_rectangle([W - 64, 70, W - 52, 106], radius=4, fill=(255, 255, 255, 255))
    return img.resize((w, h), Image.Resampling.LANCZOS)


def draw_hole(size=64, outer_col=(203, 213, 225), inner_col=(100, 116, 139)) -> Image.Image:
    S = size * 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S // 2, S // 2
    r = S // 2 - 4
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=outer_col + (255,))
    r2 = int(r * 0.80)
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=inner_col + (255,))
    r3 = int(r * 0.68)
    d.ellipse([cx - r3, cy - r3 + 4, cx + r3, cy + r3 + 4], fill=(71, 85, 105, 255))
    return img.resize((size, size), Image.Resampling.LANCZOS)


def reskin_board_png(path: Path):
    """Re-render every board sprite from its alpha silhouette into a fresh frosted-acrylic / glossy-bezel look."""
    with Image.open(path) as src:
        src = src.convert("RGBA")
        w, h = src.size
        alpha = src.getchannel("A")
        # Determine if this is an outer outline frame (hollow center) or solid fill shape
        # Sample average alpha ratio
        hist = alpha.histogram()
        opaque_px = sum(hist[128:])
        total_px = max(1, w * h)
        # Measure interior fill ratio via bounding box
        bb = alpha.getbbox()
        if not bb:
            return
        bw = max(1, bb[2] - bb[0])
        bh = max(1, bb[3] - bb[1])
        fill_ratio = opaque_px / (bw * bh)

        # Fresh crisp silhouette mask
        mask = alpha.point(lambda a: 255 if a > 96 else 0)
        soft_mask = alpha.point(lambda a: min(255, int(a * 1.15)))

        if fill_ratio < 0.28:
            # Outer white metallic-glass bezel frame
            out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            # Outer subtle slate contour
            eroded = mask.filter(ImageFilter.MinFilter(3))
            rim = ImageChops.subtract(mask, eroded)
            white_layer = Image.new("RGBA", (w, h), (255, 255, 255, 255))
            contour_layer = Image.new("RGBA", (w, h), (148, 163, 184, 255))
            out.paste(white_layer, (0, 0), soft_mask)
            out.paste(contour_layer, (0, 0), rim)
            out.save(path)
        else:
            # Solid acrylic interior board (white base so Cocos Sprite.color tints it cleanly!)
            out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            base = Image.new("RGBA", (w, h), (245, 248, 255, 255))
            # Add subtle diagonal glass gloss band
            sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sheen)
            sd.polygon([(0, int(h * 0.15)), (int(w * 0.65), 0), (w, 0), (0, int(h * 0.55))], fill=(255, 255, 255, 55))
            sd.polygon([(int(w * 0.35), h), (w, int(h * 0.45)), (w, int(h * 0.72)), (int(w * 0.62), h)], fill=(255, 255, 255, 35))
            # Subtle inner edge highlight
            eroded = mask.filter(ImageFilter.MinFilter(5))
            inner_rim = ImageChops.subtract(mask, eroded)
            rim_layer = Image.new("RGBA", (w, h), (255, 255, 255, 110))
            combined = Image.alpha_composite(base, sheen)
            combined = Image.alpha_composite(combined, Image.composite(rim_layer, Image.new("RGBA", (w, h), (0, 0, 0, 0)), inner_rim))
            out.paste(combined, (0, 0), soft_mask)
            out.save(path)


def draw_backgrounds():
    # 1. Overseas warm sky-blue to mint workshop menu backdrop
    W, H = 750, 1334
    menu_bg = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(menu_bg)
    for y in range(H):
        t = y / H
        r = int(56 + (165 - 56) * t)
        g = int(189 + (243 - 189) * t)
        b = int(248 + (252 - 248) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b, 255))
    # Subtle workshop hex nut pattern
    pat = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pat)
    for row in range(-1, 14):
        for col in range(-1, 8):
            cx = col * 130 + (65 if row % 2 else 0)
            cy = row * 115
            pts = [(cx + 28 * math.cos(math.radians(60 * k)), cy + 28 * math.sin(math.radians(60 * k))) for k in range(6)]
            pd.polygon(pts, fill=(255, 255, 255, 24))
            pd.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=(56, 189, 248, 35))
    menu_bg = Image.alpha_composite(menu_bg, pat)
    menu_bg.save(UI_ORIG_DIR / "bg_menu_hex.png")

    # 2. Clean soft pastel sky-blue faceted playfield background
    game_bg = Image.new("RGB", (W, H), (168, 218, 252))
    gd = ImageDraw.Draw(game_bg)
    for y in range(H):
        t = y / H
        r = int(172 + (212 - 172) * t)
        g = int(218 + (236 - 218) * t)
        b = int(252 + (255 - 252) * t)
        gd.line([(0, y), (W, y)], fill=(r, g, b))
    # Subtle geometric facets
    facets = [
        ([(0, 420), (420, 620), (0, 920)], (188, 228, 254)),
        ([(750, 380), (380, 680), (750, 980)], (182, 224, 252)),
        ([(120, 920), (620, 820), (750, 1334), (0, 1334)], (196, 232, 254)),
    ]
    for pts, col in facets:
        gd.polygon(pts, fill=col)
    game_bg.save(UI_ORIG_DIR / "bg_game_poly.jpg", quality=92)


def draw_ui_sprites():
    # Top white frosted header panel (frame.png)
    W, H = 750, 420
    fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fr)
    fd.rounded_rectangle([0, -40, W, H - 8], radius=40, fill=(203, 213, 225, 255))
    fd.rounded_rectangle([0, -40, W, H - 18], radius=40, fill=(248, 250, 252, 255))
    fr.save(GAMES_DIR / "frame.png")

    # Pause button (btn_pause.png)
    S = 160
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 12, S - 8, S - 4], fill=(29, 78, 216, 255))
    d.ellipse([8, 4, S - 8, S - 12], fill=(59, 130, 246, 255))
    d.ellipse([20, 12, S - 20, S // 2 + 8], fill=(147, 197, 253, 120))
    d.rounded_rectangle([50, 44, 70, 108], radius=8, fill=(255, 255, 255, 255))
    d.rounded_rectangle([90, 44, 110, 108], radius=8, fill=(255, 255, 255, 255))
    im.resize((82, 82), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "btn_pause.png")

    # Settings gear button (UI_icon_setting.png)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 12, S - 8, S - 4], fill=(15, 118, 110, 255))
    d.ellipse([8, 4, S - 8, S - 12], fill=(20, 184, 166, 255))
    d.ellipse([20, 12, S - 20, S // 2 + 8], fill=(153, 246, 228, 120))
    cx, cy = S // 2, S // 2 - 4
    for k in range(8):
        ang = math.radians(k * 45)
        gx, gy = cx + 34 * math.cos(ang), cy + 34 * math.sin(ang)
        d.ellipse([gx - 12, gy - 12, gx + 12, gy + 12], fill=(255, 255, 255, 255))
    d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=(255, 255, 255, 255))
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(20, 184, 166, 255))
    im.resize((94, 94), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "UI_icon_setting.png")

    # Close button (btn_close.png)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([8, 12, S - 8, S - 4], fill=(185, 28, 28, 255))
    d.ellipse([8, 4, S - 8, S - 12], fill=(239, 68, 68, 255))
    d.line([(50, 48), (110, 108)], fill=(255, 255, 255, 255), width=16)
    d.line([(110, 48), (50, 108)], fill=(255, 255, 255, 255), width=16)
    im.resize((68, 68), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "btn_close.png")

    # Level pill (倒计时关数框.png)
    pw, ph = 253, 47
    im = Image.new("RGBA", (pw * 2, ph * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, pw * 2 - 4, ph * 2 - 4], radius=ph - 4, fill=(30, 41, 59, 235))
    im.resize((pw, ph), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "倒计时关数框.png")

    # Skill button 3D sky-blue base (skill_btn_bg.png: 281x207)
    bw, bh = 281, 207
    im = Image.new("RGBA", (bw * 2, bh * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 22, bw * 2 - 10, bh * 2 - 6], radius=48, fill=(2, 132, 199, 255))
    d.rounded_rectangle([10, 8, bw * 2 - 10, bh * 2 - 24], radius=48, fill=(56, 189, 248, 255), outline=(12, 74, 110, 255), width=8)
    d.rounded_rectangle([28, 20, bw * 2 - 28, 86], radius=24, fill=(186, 230, 253, 140))
    im.resize((bw, bh), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "skill_btn_bg.png")

    # Skill plus badge (skill_plus.png: 88x88)
    im = Image.new("RGBA", (176, 176), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([10, 14, 166, 170], fill=(21, 128, 61, 255))
    d.ellipse([10, 6, 166, 162], fill=(74, 222, 128, 255), outline=(255, 255, 255, 255), width=10)
    d.rounded_rectangle([48, 72, 128, 96], radius=10, fill=(255, 255, 255, 255))
    d.rounded_rectangle([76, 44, 100, 124], radius=10, fill=(255, 255, 255, 255))
    im.resize((88, 88), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "skill_plus.png")

    # Skill icon: Broom / Clear (UI_icon3.png: 244x273)
    im = Image.new("RGBA", (244, 273), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Handle
    d.line([(65, 45), (150, 150)], fill=(180, 83, 9, 255), width=26)
    d.line([(65, 45), (150, 150)], fill=(245, 158, 11, 255), width=16)
    # Bristle head
    d.polygon([(115, 155), (185, 115), (225, 215), (145, 248)], fill=(250, 204, 21, 255), outline=(146, 64, 14, 255))
    d.line([(128, 148), (178, 122)], fill=(239, 68, 68, 255), width=16)
    im.save(UI_ORIG_DIR / "UI_icon3.png")

    # Skill icon: Hammer / Melt Beaker (UI_icon2.png: 235x243)
    im = Image.new("RGBA", (235, 243), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Glowing emerald potion flask
    d.rounded_rectangle([84, 26, 151, 56], radius=10, fill=(203, 213, 225, 255), outline=(51, 65, 85, 255), width=6)
    d.polygon([(94, 56), (141, 56), (200, 198), (35, 198)], fill=(226, 232, 240, 220), outline=(51, 65, 85, 255))
    d.polygon([(66, 126), (169, 126), (194, 194), (41, 194)], fill=(34, 197, 94, 255))
    d.ellipse([90, 148, 114, 172], fill=(187, 247, 208, 220))
    d.ellipse([130, 162, 146, 178], fill=(187, 247, 208, 220))
    im.save(UI_ORIG_DIR / "UI_icon2.png")

    # Craft Crate (xzx.png: 220x160)
    im = Image.new("RGBA", (220, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(25, 55), (110, 25), (195, 55), (195, 138), (110, 155), (25, 138)], fill=(217, 160, 91, 255), outline=(120, 53, 15, 255))
    d.polygon([(110, 75), (195, 55), (195, 138), (110, 155)], fill=(180, 118, 56, 255))
    d.polygon([(10, 42), (98, 18), (110, 58), (25, 72)], fill=(245, 199, 132, 255), outline=(120, 53, 15, 255))
    d.polygon([(210, 42), (122, 18), (110, 58), (195, 72)], fill=(235, 180, 108, 255), outline=(120, 53, 15, 255))
    im.save(UI_ORIG_DIR / "xzx.png")

    # Flying Star Bolt (flyGold.png: 64x64)
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = []
    for k in range(10):
        ang = math.radians(k * 36 - 90)
        rad = 54 if k % 2 == 0 else 24
        pts.append((64 + rad * math.cos(ang), 64 + rad * math.sin(ang)))
    d.polygon(pts, fill=(250, 204, 21, 255), outline=(180, 83, 9, 255))
    im.resize((64, 64), Image.Resampling.LANCZOS).save(UI_ORIG_DIR / "flyGold.png")

    # Warm Oak Gallery Frame (wood_frame.png: 560x560)
    W, H = 560, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 8, W - 4, H - 2], radius=24, fill=(15, 23, 42, 60))
    d.rounded_rectangle([4, 4, W - 4, H - 8], radius=24, fill=(146, 64, 14, 255), outline=(92, 38, 8, 255), width=6)
    d.rounded_rectangle([14, 14, W - 14, H - 18], radius=18, fill=(180, 83, 9, 255))
    d.rounded_rectangle([38, 38, W - 38, H - 42], radius=12, fill=(254, 252, 245, 255), outline=(120, 53, 15, 255), width=4)
    # 4 brass corner bolts
    for cx, cy in [(22, 22), (W - 22, 22), (22, H - 26), (W - 22, H - 26)]:
        d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=(250, 204, 21, 255), outline=(120, 53, 15, 255), width=3)
    im.save(UI_ORIG_DIR / "wood_frame.png")

    # Progress bar track & golden fill (UI_jdt_1.png, UI_jdt_2.png)
    bw, bh = 500, 42
    tr = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(tr).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=21, fill=(51, 65, 85, 220), outline=(255, 255, 255, 180), width=3)
    tr.save(UI_ORIG_DIR / "UI_jdt_1.png")
    fl = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(fl).rounded_rectangle([3, 3, bw - 4, bh - 4], radius=18, fill=(250, 204, 21, 255))
    ImageDraw.Draw(fl).rounded_rectangle([8, 6, bw - 9, 18], radius=6, fill=(254, 240, 138, 180))
    fl.save(UI_ORIG_DIR / "UI_jdt_2.png")

    # Primary glossy Play CTA button (按键1.png: 400x120)
    bw, bh = 400, 120
    btn = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(btn)
    bd.rounded_rectangle([6, 12, bw - 6, bh - 2], radius=54, fill=(21, 128, 61, 255))
    bd.rounded_rectangle([6, 4, bw - 6, bh - 12], radius=54, fill=(34, 197, 94, 255), outline=(255, 255, 255, 230), width=5)
    bd.rounded_rectangle([26, 12, bw - 26, 46], radius=20, fill=(134, 239, 172, 130))
    btn.save(UI_ORIG_DIR / "按键1.png")

    # Popup card (UI_db2.png: 520x580)
    cw, ch = 520, 580
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([6, 12, cw - 6, ch - 4], radius=38, fill=(148, 163, 184, 255))
    cd.rounded_rectangle([6, 4, cw - 6, ch - 14], radius=38, fill=(255, 255, 255, 255), outline=(56, 189, 248, 255), width=8)
    card.save(UI_ORIG_DIR / "UI_db2.png")

    # Clean Touch Spine PNG (128x64, RGB=0 on transparent pixels!)
    tp = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    td = ImageDraw.Draw(tp)
    # 4-point sparkle star at (2, 2, 52, 52)
    scx, scy = 27, 27
    star_pts = [(scx, scy - 23), (scx + 6, scy - 6), (scx + 23, scy), (scx + 6, scy + 6), (scx, scy + 23), (scx - 6, scy + 6), (scx - 23, scy), (scx - 6, scy - 6)]
    td.polygon(star_pts, fill=(255, 250, 210, 255))
    # Soft glow at (54, 12, 94, 52)
    for r in range(18, 0, -2):
        a = int(140 * (1 - r / 20) ** 1.5)
        td.ellipse([74 - r, 32 - r, 74 + r, 32 + r], fill=(255, 245, 200, a))
    # Spark particle at (96, 24, 124, 52)
    for r in range(12, 0, -2):
        a = int(220 * (1 - r / 14) ** 1.6)
        td.ellipse([110 - r, 38 - r, 110 + r, 38 + r], fill=(255, 255, 255, a))
    tp.save(TOUCH_PNG)


def main():
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
    UI_DIR.mkdir(parents=True, exist_ok=True)
    UI_ORIG_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Replace all 11 screws, 11 boxes, 10 covers, holes
    for c in range(1, 12):
        draw_screw(c).save(GAMES_DIR / f"gbz_screw{c}.png")
    for c in range(0, 11):
        draw_toolbox(c).save(GAMES_DIR / f"gbz_box{c}.png")
    for c in range(1, 11):
        draw_cover(c).save(GAMES_DIR / f"gbz_cover{c}.png")

    hole = draw_hole(64)
    hole.save(GAMES_DIR / "hole.png")
    hole.save(UI_DIR / "gbz_screw_core.png")
    hole.save(UI_ORIG_DIR / "gbz_screw_core.png")

    locked = draw_locked_box()
    locked.save(UI_DIR / "解锁盒子.png")
    locked.save(UI_ORIG_DIR / "解锁盒子.png")

    # 2. Replace all 120 board sprites with original frosted acrylic / bezel look
    board_count = 0
    for p in sorted(BOARDS_DIR.glob("*.png")):
        reskin_board_png(p)
        board_count += 1

    # 3. Replace backgrounds, UI sprites, and touch Spine texture
    draw_backgrounds()
    draw_ui_sprites()

    print(f"Original art reskin complete: 11 screws, 11 boxes, 10 covers, {board_count} acrylic boards, UI & touch Spine.")


if __name__ == "__main__":
    main()
