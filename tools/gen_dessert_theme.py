#!/usr/bin/env python3
"""
AAA 3D Studio Art Upgrader for ScrewOut Sweet Dessert & Nordic Themes.
- Derives Sweet Dessert 3D candy screws & pastry gift boxes directly from our
  real studio-rendered 3D masters (gbz_screw*, gbz_box*, box_locked) so they
  retain photorealistic 3D bevels, reflections, and depth — upgraded with a
  juicy candy-glaze subsurface glow and warm ivory-cream inner trays.
- Generates a sleek frosted-pearl 3D header deck (zero cheap 2D scallops) and
  ultra-clean dreamy patisserie backdrop (zero cheap 2D rectangle sprinkles).
- Enhances all board fill sprites with subtle 3D glossy top-left bevel sheen
  so stacked boards look plump, tactile, and luxury-grade.
"""
import colorsys
import glob
import json
import math
import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = "/Users/echo/workspace/CocosGames/ScrewOut"
BRAIN = "/Users/echo/.gemini/antigravity/brain/05eb0bcf-ffeb-431e-8794-b4ee4450d4b1"
GAMES_DIR = os.path.join(ROOT, "assets/resources/sprites/games")
UI_ORIG_DIR = os.path.join(ROOT, "assets/resources/sprites/ui_orig")
BOARDS_DIR = os.path.join(ROOT, "assets/resources/sprites/boards")
DESSERT_DIR = os.path.join(ROOT, "assets/resources/sprites/themes/dessert")
NORDIC_DIR = os.path.join(ROOT, "assets/resources/sprites/themes/nordic")
SRC_MENU_BG = os.path.join(BRAIN, "bg_dessert_menu_1795678219479.jpg")

os.makedirs(DESSERT_DIR, exist_ok=True)
os.makedirs(NORDIC_DIR, exist_ok=True)


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def bleed_transparent_rgb(im: Image.Image, passes: int = 5) -> Image.Image:
    out = im.convert("RGBA")
    w, h = out.size
    px = out.load()
    for _ in range(passes):
        updates = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 and r == 0 and g == 0 and b == 0:
                    sr = sg = sb = cnt = 0
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        if 0 <= nx < w and 0 <= ny < h:
                            nr, ng, nb, na = px[nx, ny]
                            if na > 0 or (nr > 0 or ng > 0 or nb > 0):
                                sr += nr; sg += ng; sb += nb; cnt += 1
                    if cnt > 0:
                        updates.append((x, y, sr // cnt, sg // cnt, sb // cnt))
        for x, y, r, g, b in updates:
            px[x, y] = (r, g, b, 0)
    return out


def candy_glaze_3d_screw(src_path: str, color_id: int) -> Image.Image:
    """
    Upgrades a real 3D studio-rendered screw into a mouthwatering glossy
    fruit-candy / gummy-enamel 3D screw while preserving 100% of the real 3D
    lighting, specular crescent, and cross-slot depth!
    """
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    px = im.load()
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    R = min(w, h) * 0.48

    for y in range(h):
        dy = (y - cy) / R
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hh, ss, vv = colorsys.rgb_to_hsv(rf, gf, bf)

            # Candy-glaze lift: brighter translucent midtones + juicier saturation
            # Keep dark chocolate/black (#10) and pearl white (#9) refined
            if color_id == 10:
                # Rich glossy dark chocolate cocoa tint
                hh = 0.06
                ss = min(0.45, ss + 0.22)
                vv = min(1.0, vv * 1.18 + 0.04)
            elif color_id == 9:
                # Warm vanilla-pearl cream glaze
                vv = min(1.0, vv * 1.04 + 0.03)
                ss = min(0.10, ss)
            else:
                # Juicy translucent candy lift (brighter shadows, glowing lower-right subsurface)
                dist = math.sqrt(dx_dy := (x - cx) ** 2 + (y - cy) ** 2) / R
                subsurf = max(0.0, (x - cx) / R * 0.45 + (y - cy) / R * 0.55 + 0.25) * min(1.0, dist) * 0.16
                vv = min(1.0, (vv ** 0.84) * 1.06 + subsurf)
                if ss > 0.12:
                    ss = min(1.0, ss * 1.08)

            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss, vv)
            px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)

    return bleed_transparent_rgb(im, passes=5)


def candy_glaze_3d_box(src_path: str, color_id: int) -> Image.Image:
    """
    Upgrades our real 3D studio-rendered gbz_box*.png into a luxury glossy
    candy-ceramic gift box: bright candy-enamel outer 3D frame + warm
    vanilla-ivory inner tray (keeping 100% of real 3D lighting & sockets!).
    """
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    px = im.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hh, ss, vv = colorsys.rgb_to_hsv(rf, gf, bf)

            if ss < 0.14 and vv > 0.65:
                # Cool silver inner tray -> warm luxury vanilla-cream ceramic!
                r2 = clamp(r * 1.02 + 5)
                g2 = clamp(g * 1.00 + 2)
                b2 = clamp(b * 0.94)
                px[x, y] = (r2, g2, b2, a)
            elif color_id == 10 and ss < 0.25 and vv < 0.55:
                # Dark chocolate box frame
                nr, ng, nb = colorsys.hsv_to_rgb(0.065, 0.42, min(1.0, vv * 1.15 + 0.04))
                px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
            elif ss >= 0.18:
                # Juicy glossy candy-enamel 3D frame
                vv2 = min(1.0, (vv ** 0.86) * 1.05)
                ss2 = min(1.0, ss * 1.06)
                nr, ng, nb = colorsys.hsv_to_rgb(hh, ss2, vv2)
                px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)

    return bleed_transparent_rgb(im, passes=4)


def make_3d_pearl_socket(size: int = 96) -> Image.Image:
    """
    4x-supersampled luxury 3D machined pearl-ivory & champagne-gold socket
    for the holding tray (matches both Sweet Dessert & high-end casual UI).
    """
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = im.load()
    cx = cy = (S - 1) / 2.0
    R = S * 0.46

    for y in range(S):
        dy = (y - cy) / R
        for x in range(S):
            dx = (x - cx) / R
            r = math.sqrt(dx * dx + dy * dy)
            if r > 1.02:
                continue
            a = 255 if r <= 0.97 else clamp((1.02 - r) / 0.05 * 255)
            if a == 0:
                continue

            if r >= 0.72:
                # Smooth 3D champagne-pearl beveled outer ring
                t = (r - 0.72) / 0.28
                bevel = math.sin(t * math.pi)
                light = max(0.0, -dx * 0.55 - dy * 0.65)
                base_v = 216 + 34 * bevel + 22 * light - 26 * (t ** 2)
                cr = clamp(base_v + 8)
                cg = clamp(base_v + 1)
                cb = clamp(base_v - 10)
                px[x, y] = (cr, cg, cb, a)
            else:
                # Softly shaded recessed warm-slate/cocoa socket interior
                t = r / 0.72
                # Top-left inner cast shadow, subtle warm bottom-right bounce
                ao = max(0.0, (-dx * 0.5 - dy * 0.65 + 0.35)) * (t ** 1.8)
                bounce = max(0.0, (dx * 0.45 + dy * 0.55)) * (t ** 1.4)
                cr = clamp(92 - 38 * ao + 28 * bounce)
                cg = clamp(82 - 34 * ao + 24 * bounce)
                cb = clamp(96 - 30 * ao + 22 * bounce)
                px[x, y] = (cr, cg, cb, a)

    out = im.resize((size, size), Image.Resampling.LANCZOS)
    return bleed_transparent_rgb(out, passes=3)


def make_clean_dessert_backgrounds():
    """
    Ultra-clean, luminous patisserie studio backgrounds:
    - ZERO cheap 2D rectangle sprinkles!
    - Dreamy sculpted clouds & warm pastel spotlight glow.
    """
    if os.path.exists(SRC_MENU_BG):
        src = Image.open(SRC_MENU_BG).convert("RGB")
        src.resize((750, 1334), Image.Resampling.LANCZOS).save(
            os.path.join(DESSERT_DIR, "bg_dessert_menu.jpg"), quality=94
        )
        # Playfield: zoom into the clean dreamy warm-blush studio core with soft radial spotlight
        sw, sh = src.size
        crop = src.crop((int(sw * 0.10), int(sh * 0.14), int(sw * 0.90), int(sh * 0.86)))
        game_bg = crop.resize((750, 1334), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(6))
        # Subtle warm luminous center glow so the 3D puzzle stack pops like jewels!
        glow = Image.new("RGBA", (750, 1334), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([40, 380, 710, 1140], fill=(255, 252, 246, 95))
        glow = glow.filter(ImageFilter.GaussianBlur(85))
        final_bg = Image.alpha_composite(game_bg.convert("RGBA"), glow).convert("RGB")
        final_bg.save(os.path.join(DESSERT_DIR, "bg_dessert_game.jpg"), quality=94)

    # Sleek, modern 3D frosted pearl-cream top header deck with soft ambient drop shadow
    W, H = 750, 420
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Soft ambient drop shadow below deck
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([-20, -40, W + 20, 404], radius=44, fill=(140, 96, 112, 52))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    frame.alpha_composite(sh)

    # Main frosted pearl-ivory panel with crisp rounded bottom corners
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([-10, -40, W + 10, 396], radius=40, fill=(255, 252, 248, 252))
    # Subtle rose-cream bottom edge bevel
    d.rounded_rectangle([-10, -40, W + 10, 396], radius=40, outline=(244, 224, 230, 255), width=4)
    frame.save(os.path.join(DESSERT_DIR, "dessert_frame.png"))


def upgrade_boards_3d_gloss():
    """
    Adds a subtle, clean 3D glossy top-left bevel highlight & soft bottom inner depth
    to all board FILL sprites (preserving frame sprites as pure crisp snow-white).
    Because fill sprites stay neutral white/bright-grey, runtime tinting works for
    ALL 3 themes (Sweet Dessert, Wood & Acrylic, Minimalist Nordic) and makes every
    stacked board look plump, glazed, and 3D instead of flat 2D!
    """
    frame_names = set()
    fill_names = set()
    for lp in glob.glob(os.path.join(ROOT, "assets/resources/levels/lv_*.json")):
        with open(lp) as f:
            lv = json.load(f)
        for layer in lv.get("layers", []):
            for b in layer.get("boards", []):
                if b.get("frameSprite"):
                    frame_names.add(b["frameSprite"])
                if b.get("boardSprite"):
                    fill_names.add(b["boardSprite"])

    # Only process pure fill sprites (not used as frame)
    pure_fills = fill_names - frame_names
    upgraded = 0
    for name in sorted(pure_fills):
        path = os.path.join(BOARDS_DIR, f"{name}.png")
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        alpha = im.getchannel("A")
        # Build soft top-to-bottom 3D glazed sheen + inner edge bevel
        # Erode alpha slightly to detect interior vs edge
        inner = alpha.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(5))
        ipx = inner.load()
        apx = alpha.load()
        out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
        opx = out.load()

        for y in range(h):
            ty = y / max(1, h - 1)
            for x in range(w):
                a = apx[x, y]
                if a == 0:
                    opx[x, y] = (255, 255, 255, 0)
                    continue
                tx = x / max(1, w - 1)
                # Subtle 3D glossy dome gradient: bright upper-left (255), gentle depth lower-right (222)
                diag = (tx * 0.4 + ty * 0.6)
                v = 255 - 32 * diag
                # Soft bright bevel rim right inside the outer edge
                rim = max(0, a - ipx[x, y]) / 255.0
                if ty < 0.55:
                    v = min(255, v + 18 * rim)
                else:
                    v = max(206, v - 18 * rim)
                vi = clamp(v)
                opx[x, y] = (vi, vi, vi, a)
        out.save(path)
        upgraded += 1
    print(f"Upgraded {upgraded} board fill sprites with 3D glossy bevel shading.")


def main():
    print("Upgrading Sweet Dessert 3D screws from real studio masters...")
    for idx in range(11):
        src = os.path.join(GAMES_DIR, f"gbz_screw{idx}.png")
        if os.path.exists(src):
            out = candy_glaze_3d_screw(src, idx)
            out.save(os.path.join(DESSERT_DIR, f"dessert_screw{idx}.png"))

    print("Upgrading Sweet Dessert 3D boxes & lids from real studio masters...")
    for idx in range(11):
        src = os.path.join(GAMES_DIR, f"gbz_box{idx}.png")
        if os.path.exists(src):
            out = candy_glaze_3d_box(src, idx)
            out.save(os.path.join(DESSERT_DIR, f"dessert_box{idx}.png"))
        if idx >= 1:
            cov_src = os.path.join(GAMES_DIR, f"gbz_cover{idx}.png")
            if os.path.exists(cov_src):
                cov = Image.open(cov_src).convert("RGBA")
                cov = ImageEnhance.Brightness(cov).enhance(1.06)
                cov.save(os.path.join(DESSERT_DIR, f"dessert_cover{idx}.png"))

    # Locked box from real 3D studio-rendered box_locked.png!
    locked_src = os.path.join(UI_ORIG_DIR, "box_locked.png")
    if os.path.exists(locked_src):
        locked_im = Image.open(locked_src).convert("RGBA")
        locked_im = ImageEnhance.Brightness(locked_im).enhance(1.04)
        locked_im.save(os.path.join(DESSERT_DIR, "dessert_box_locked.png"))

    print("Generating 4x-supersampled 3D pearl-gold holding tray socket...")
    make_3d_pearl_socket(96).save(os.path.join(DESSERT_DIR, "dessert_hole.png"))

    print("Generating clean luxury patisserie backdrops & frosted pearl top deck...")
    make_clean_dessert_backgrounds()

    print("Upgrading board fill sprites with subtle 3D glossy bevel shading...")
    upgrade_boards_3d_gloss()

    print("AAA 3D Sweet Dessert aesthetic upgrade complete!")


if __name__ == "__main__":
    main()
