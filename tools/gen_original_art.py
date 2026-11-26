#!/usr/bin/env python3
"""
AAA 3D Casual Art Compositor for Screw Jam.
Takes studio-rendered 3D hero assets from image-generator, performs clean
border flood-fill alpha matting (preserving interior whites/speculars),
HSV jewel-tone color grading for all 11 screws/boxes/lids, glossy acrylic
bevel shading for all 120 board shapes, and generates the 3D threaded
screw shaft sprite for the upgraded unscrew animation.
"""
import colorsys
import math
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = "/Users/echo/workspace/CocosGames/ScrewOut"
BRAIN = "/Users/echo/.gemini/antigravity/brain/9d137123-917d-47de-ae09-97bdac13be55"
GAMES_DIR = os.path.join(ROOT, "assets/resources/sprites/games")
BOARDS_DIR = os.path.join(ROOT, "assets/resources/sprites/boards")
UI_ORIG_DIR = os.path.join(ROOT, "assets/resources/sprites/ui_orig")
TOUCH_PNG = os.path.join(ROOT, "assets/resources/spine/touch/touch.png")

SRC_BG_MENU = os.path.join(BRAIN, "bg_menu_raw_1795665751395.jpg")
SRC_BG_GAME = os.path.join(BRAIN, "bg_game_raw_1795665746541.jpg")
SRC_SCREW_RED = os.path.join(BRAIN, "screw_3d_red_1795665794460.jpg")
SRC_BOX_RED = os.path.join(BRAIN, "box_3d_red_1795665770693.jpg")
SRC_WOOD_FRAME = os.path.join(BRAIN, "wood_frame_3d_1795665752966.jpg")
SRC_PADLOCK = os.path.join(BRAIN, "padlock_3d_1795665769090.jpg")
SRC_CRATE = os.path.join(BRAIN, "crate_3d_v2_1795665787410.jpg")
SRC_POTION = os.path.join(BRAIN, "potion_3d_1795665795958.jpg")
SRC_BROOM = os.path.join(BRAIN, "magic_whisk_broom_icon_1795665792684.jpg")
SRC_COIN = os.path.join(BRAIN, "golden_star_coin_icon_1795665797558.jpg")

# 10 maximally distinct, zero-ambiguity casual puzzle colors (no duplicate greens or muddy browns!)
# Source master is vivid crimson red (hue ~ 0.0 / 0.99)
COLOR_TARGETS = {
    0:  (0.60, 0.10, 0.95),  # Neutral Silver (fallback)
    1:  (0.99, 1.05, 1.00),  # 1: Crimson Red
    2:  (0.145, 1.08, 1.38), # 2: Bright Lemon Yellow
    3:  (0.38, 1.02, 0.94),  # 3: Emerald Green (ONLY green!)
    4:  (0.64, 1.06, 0.98),  # 4: Deep Royal Blue
    5:  (0.77, 0.96, 1.06),  # 5: Vivid Royal Purple
    6:  (0.072, 1.08, 1.24), # 6: Bright Tangerine Orange
    7:  (0.915, 0.68, 1.32), # 7: Bright Bubblegum Pink
    8:  (0.515, 0.88, 1.28), # 8: Bright Ice Cyan
    9:  (0.58, 0.05, 1.42),  # 9: Glossy Pearl White / Silver (replaces duplicate lime-green!)
    10: (0.60, 0.14, 0.42),  # 10: Glossy Obsidian Charcoal (replaces muddy brown!)
}


def flood_remove_white_bg(img: Image.Image, thresh: int = 236, feather: float = 1.0) -> Image.Image:
    """
    Removes ONLY the exterior pure-white background by flood-filling from image borders.
    Interior white highlights, recessed white panels, and glossy speculars are 100% preserved!
    """
    im = img.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    q = deque()

    def is_bg(r, g, b):
        return r >= thresh and g >= thresh and b >= thresh and (max(r, g, b) - min(r, g, b)) <= 22

    # Seed from all 4 border edges
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        visited[idx] = 1
                        q.append((nx, ny))

    # Build smooth alpha mask
    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        row_off = y * w
        for x in range(w):
            if visited[row_off + x]:
                apx[x, y] = 0
                px[x, y] = (0, 0, 0, 0)

    # Soften 1px fringe against white background by slightly eroding & feathering alpha
    if feather > 0:
        alpha = alpha.filter(ImageFilter.MinFilter(3))
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    im.putalpha(alpha)

    # Crop tightly to non-transparent bounding box with tiny margin
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def hue_grade_red_master(im: Image.Image, target_h: float, sat_mul: float, val_mul: float,
                         min_sat_to_shift: float = 0.22) -> Image.Image:
    """
    Shifts saturated red/crimson pixels to the target jewel-tone hue while keeping
    neutral white highlights, silver inner panels, and dark specular reflections pristine.
    """
    src = im.convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h))
    spx = src.load()
    opx = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = spx[x, y]
            if a == 0:
                opx[x, y] = (0, 0, 0, 0)
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hh, ss, vv = colorsys.rgb_to_hsv(rf, gf, bf)
            # Only shift pixels that actually have red/warm saturation (preserve neutral whites/silvers)
            if ss >= min_sat_to_shift:
                # Smooth blend factor near threshold to prevent harsh edges
                blend = min(1.0, (ss - min_sat_to_shift) / 0.18)
                new_s = min(1.0, ss * (1.0 - blend + blend * sat_mul))
                new_v = min(1.0, vv * (1.0 - blend + blend * val_mul))
                # Shift hue toward target_h
                nr, ng, nb = colorsys.hsv_to_rgb(target_h, new_s, new_v)
                r2 = int((rf * (1.0 - blend) + nr * blend) * 255)
                g2 = int((gf * (1.0 - blend) + ng * blend) * 255)
                b2 = int((bf * (1.0 - blend) + nb * blend) * 255)
                opx[x, y] = (max(0, min(255, r2)), max(0, min(255, g2)), max(0, min(255, b2)), a)
            else:
                opx[x, y] = (r, g, b, a)
    return out


def make_3d_screws():
    raw = Image.open(SRC_SCREW_RED)
    # Remove white background cleanly
    cut = flood_remove_white_bg(raw, thresh=232, feather=0.8)
    # Make square centered with crisp circular trim so rotation never clips
    side = max(cut.width, cut.height)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2), cut)
    master = sq.resize((128, 128), Image.Resampling.LANCZOS)

    # Apply tiny soft drop-shadow behind each screw for depth on acrylic boards
    for idx, (th, sm, vm) in COLOR_TARGETS.items():
        graded = hue_grade_red_master(master, th, sm, vm, min_sat_to_shift=0.14)
        canvas = Image.new("RGBA", (116, 116), (0, 0, 0, 0))
        scaled = graded.resize((104, 104), Image.Resampling.LANCZOS)
        # Soft contact shadow
        sh = Image.new("RGBA", (116, 116), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.ellipse([8, 10, 108, 110], fill=(15, 23, 42, 75))
        sh = sh.filter(ImageFilter.GaussianBlur(3.2))
        canvas.alpha_composite(sh)
        canvas.alpha_composite(scaled, (6, 4))
        canvas.save(os.path.join(GAMES_DIR, f"gbz_screw{idx}.png"))

    # Also build a crisp 3D metallic threaded screw shaft for the 3D unscrew animation!
    shaft = Image.new("RGBA", (44, 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(shaft)
    # Tapered metallic cylinder
    for y in range(4, 102):
        t = (y - 4) / 98.0
        half_w = 13.5 * (1.0 - 0.18 * (t ** 2.2))
        if y > 90:
            half_w *= max(0.15, (102 - y) / 12.0)
        x0 = int(22 - half_w)
        x1 = int(22 + half_w)
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, (x1 - x0))
            # Metallic cylindrical specular shading (bright left-center highlight)
            cyl = 0.42 + 0.58 * math.exp(-((u - 0.34) / 0.24) ** 2) - 0.18 * ((u - 0.5) ** 2)
            # Helical thread ridges!
            ridge = math.sin((y * 0.52) + u * 2.2)
            lum = int(max(45, min(252, (168 + 44 * ridge) * cyl)))
            shaft.putpixel((x, y), (lum, min(255, int(lum * 1.02)), min(255, int(lum * 1.08)), 255))
    shaft.save(os.path.join(GAMES_DIR, "screw_shaft.png"))


def draw_3d_socket_hole(size: int) -> Image.Image:
    """Machined 3D metallic recessed screw hole with inner depth shadow & bright rim."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Outer metallic bevel ring
    d.ellipse([1, 1, size - 2, size - 2], fill=(215, 224, 236, 255), outline=(148, 163, 184, 255), width=2)
    # Inner deep recess
    m = max(4, size // 7)
    d.ellipse([m, m, size - m, size - m], fill=(42, 52, 68, 255))
    # Subtle top inner shadow + bottom rim light
    d.arc([m, m, size - m, size - m], start=190, end=350, fill=(18, 24, 36, 220), width=max(2, size // 16))
    d.arc([m, m, size - m, size - m], start=20, end=160, fill=(100, 116, 139, 180), width=max(1, size // 22))
    return im


def make_3d_boxes_and_lids():
    raw_box = Image.open(SRC_BOX_RED)
    cut_box = flood_remove_white_bg(raw_box, thresh=232, feather=0.9)
    # Resize to 164x212 (exact TargetBox aspect ratio)
    box_master = cut_box.resize((164, 212), Image.Resampling.LANCZOS)

    # Recessed 3D screw sockets for the 3-hole triangle inside TargetBox
    hole_sm = draw_3d_socket_hole(34)
    # Exact positions aligned with TargetBox.ts (holes at (0, 26), (-36, -24), (36, -24) around center (82, 112))
    hole_positions = [(82 - 17, 94 - 17), (46 - 17, 144 - 17), (118 - 17, 144 - 17)]

    for idx, (th, sm, vm) in COLOR_TARGETS.items():
        graded = hue_grade_red_master(box_master, th, sm, vm, min_sat_to_shift=0.26)
        # Paste the 3 machined 3D screw sockets onto the clean inner silver-white tray
        with_holes = graded.copy()
        for hx, hy in hole_positions:
            with_holes.alpha_composite(hole_sm, (hx, hy))
        with_holes.save(os.path.join(GAMES_DIR, f"gbz_box{idx}.png"))

        # Generate matching glossy 3D lid (gbz_cover1..10) that snaps smoothly over the tray
        if idx >= 1:
            lid = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
            # Build solid glossy tinted acrylic lid with specular highlight & latch
            # Sample the box's main body color from top rim
            rim_px = graded.getpixel((82, 42))
            rr, gg, bb = rim_px[0], rim_px[1], rim_px[2]
            d = ImageDraw.Draw(lid)
            d.rounded_rectangle([12, 34, 152, 198], radius=24, fill=(rr, gg, bb, 245),
                                outline=(min(255, rr + 50), min(255, gg + 50), min(255, bb + 50), 255), width=3)
            # Glossy diagonal glass sheen across lid
            sheen = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sheen)
            sd.rounded_rectangle([20, 42, 144, 108], radius=18, fill=(255, 255, 255, 78))
            sd.rounded_rectangle([54, 166, 110, 184], radius=9, fill=(255, 255, 255, 110))
            lid.alpha_composite(sheen)
            lid.save(os.path.join(GAMES_DIR, f"gbz_cover{idx}.png"))

    # Locked box (mint-teal 3D toolbox + AAA 3D golden padlock!)
    raw_lock = Image.open(SRC_PADLOCK)
    cut_lock = flood_remove_white_bg(raw_lock, thresh=232, feather=0.9)
    lock_icon = cut_lock.resize((88, 100), Image.Resampling.LANCZOS)

    locked_box = hue_grade_red_master(box_master, 0.46, 0.72, 1.05, min_sat_to_shift=0.26)
    # Softly tint inner panel mint-frost so the golden padlock pops
    tint = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
    td = ImageDraw.Draw(tint)
    td.rounded_rectangle([22, 54, 142, 184], radius=16, fill=(100, 224, 198, 145))
    locked_box.alpha_composite(tint)
    # Add soft shadow under padlock + composite 3D golden padlock
    locked_box.alpha_composite(lock_icon, ((164 - 88) // 2, 68))
    # Small crisp green '+' badge in upper-right corner
    bd = ImageDraw.Draw(locked_box)
    bd.ellipse([122, 32, 156, 66], fill=(34, 197, 94, 255), outline=(255, 255, 255, 255), width=3)
    bd.rectangle([136, 40, 142, 58], fill=(255, 255, 255, 255))
    bd.rectangle([130, 46, 148, 52], fill=(255, 255, 255, 255))
    locked_box.save(os.path.join(UI_ORIG_DIR, "解锁盒子.png"))

    # Holding tray hole & screw core
    hole_big = draw_3d_socket_hole(72)
    hole_big.save(os.path.join(GAMES_DIR, "hole.png"))
    hole_core = draw_3d_socket_hole(96)
    hole_core.save(os.path.join(UI_ORIG_DIR, "gbz_screw_core.png"))
    hole_core.save(os.path.join(GAMES_DIR, "gbz_screw_core.png"))


def make_glossy_acrylic_boards():
    """
    Upgrades all 120 board fill & frame silhouettes with real translucent
    beveled acrylic/crystal glass shading (crisp rim, diagonal sheen, soft depth).
    """
    count = 0
    for fname in os.listdir(BOARDS_DIR):
        if not fname.endswith(".png"):
            continue
        fpath = os.path.join(BOARDS_DIR, fname)
        im = Image.open(fpath).convert("RGBA")
        w, h = im.size
        alpha = im.split()[3]
        is_frame = ("_1." in fname) or ("frame" in fname.lower())

        if is_frame:
            # Crisp glossy white/frosted acrylic outer rim with subtle depth
            out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            grad = Image.new("RGBA", (w, h), (255, 255, 255, 255))
            gd = ImageDraw.Draw(grad)
            for y in range(h):
                t = y / max(1, h - 1)
                v = int(255 - 24 * t)
                gd.line([(0, y), (w, y)], fill=(v, min(255, v + 3), min(255, v + 8), 255))
            out.paste(grad, (0, 0), alpha)
            out.save(fpath)
        else:
            # Translucent glossy crystal slab (tinted at runtime by Cocos Sprite.color)
            # We bake rich lighting (top-left bright specular, diagonal sheen, bottom depth) into white-base RGB!
            base = Image.new("RGBA", (w, h), (255, 255, 255, 255))
            bd = ImageDraw.Draw(base)
            for y in range(h):
                t = y / max(1, h - 1)
                # Subtle top-bright to bottom-deep vertical studio gradient
                lum = int(252 - 42 * t)
                bd.line([(0, y), (w, y)], fill=(lum, lum, min(255, lum + 5), 255))

            # Diagonal soft glass reflection streak
            sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sheen)
            sd.polygon([
                (int(w * 0.05), 0), (int(w * 0.38), 0),
                (0, int(h * 0.42)), (0, int(h * 0.12))
            ], fill=(255, 255, 255, 95))
            sd.polygon([
                (int(w * 0.48), 0), (int(w * 0.60), 0),
                (int(w * 0.08), int(h * 0.56)), (0, int(h * 0.48))
            ], fill=(255, 255, 255, 55))
            sheen = sheen.filter(ImageFilter.GaussianBlur(4))
            base.alpha_composite(sheen)

            # Inner beveled rim highlight (erode alpha to find edge)
            eroded = alpha.filter(ImageFilter.MinFilter(5))
            apx = alpha.load()
            epx = eroded.load()
            bpx = base.load()
            for y in range(h):
                for x in range(w):
                    a = apx[x, y]
                    if a == 0:
                        bpx[x, y] = (0, 0, 0, 0)
                    elif epx[x, y] < a:
                        # Crisp glowing glass edge
                        bpx[x, y] = (255, 255, 255, a)
                    else:
                        r, g, b, _ = bpx[x, y]
                        bpx[x, y] = (r, g, b, a)
            base.save(fpath)
        count += 1
    return count


def make_3d_ui_and_backgrounds():
    # 1. Sunlit Bokeh Home Menu Background
    bg_menu = Image.open(SRC_BG_MENU).convert("RGB").resize((750, 1334), Image.Resampling.LANCZOS)
    bg_menu.save(os.path.join(UI_ORIG_DIR, "bg_menu_hex.png"))

    # 2. Clean Studio Playfield Background
    bg_game = Image.open(SRC_BG_GAME).convert("RGB").resize((750, 1334), Image.Resampling.LANCZOS)
    bg_game.save(os.path.join(UI_ORIG_DIR, "bg_game_poly.jpg"), quality=94)

    # 3. 3D Handcrafted Oak Wooden Frame
    wf_raw = Image.open(SRC_WOOD_FRAME)
    wf_cut = flood_remove_white_bg(wf_raw, thresh=236, feather=0.9)
    wf_cut.resize((520, 520), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "wood_frame.png"))

    # 4. 3D Cardboard Shipping Crate (xzx.png)
    crate_raw = Image.open(SRC_CRATE)
    crate_cut = flood_remove_white_bg(crate_raw, thresh=234, feather=0.9)
    crate_cut.resize((128, 108), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "xzx.png"))

    # 5. 3D Magic Broom (Clear Tray icon - UI_icon3.png)
    broom_raw = Image.open(SRC_BROOM)
    broom_cut = flood_remove_white_bg(broom_raw, thresh=234, feather=0.9)
    broom_cut.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "UI_icon3.png"))

    # 6. 3D Magic Potion Flask (Melt Board icon - UI_icon2.png)
    pot_raw = Image.open(SRC_POTION)
    pot_cut = flood_remove_white_bg(pot_raw, thresh=234, feather=0.9)
    pot_cut.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "UI_icon2.png"))

    # 7. 3D Golden Star Coin (flyGold.png)
    coin_raw = Image.open(SRC_COIN)
    coin_cut = flood_remove_white_bg(coin_raw, thresh=234, feather=0.9)
    coin_cut.resize((96, 96), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "flyGold.png"))

    # 8. Rich Glossy 3D Pill Play Button (按键1.png)
    play = Image.new("RGBA", (420, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(play)
    # Bottom 3D lip shadow
    d.rounded_rectangle([6, 14, 414, 124], radius=55, fill=(14, 118, 56, 255))
    # Main emerald gradient body
    body = Image.new("RGBA", (420, 128), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    for y in range(6, 112):
        t = (y - 6) / 106.0
        r = int(74 - 50 * t)
        g = int(234 - 66 * t)
        b = int(112 - 42 * t)
        bd.line([(0, y), (420, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (420, 128), 0)
    ImageDraw.Draw(mask).rounded_rectangle([8, 6, 412, 112], radius=52, fill=255)
    play.paste(body, (0, 0), mask)
    # Bright glossy specular pill highlight on top
    spec = Image.new("RGBA", (420, 128), (0, 0, 0, 0))
    ImageDraw.Draw(spec).rounded_rectangle([28, 12, 392, 54], radius=21, fill=(255, 255, 255, 92))
    play.alpha_composite(spec)
    # Crisp white outer bevel stroke
    d.rounded_rectangle([8, 6, 412, 112], radius=52, outline=(255, 255, 255, 210), width=4)
    play.save(os.path.join(UI_ORIG_DIR, "按键1.png"))

    # 9. Rich Glossy 3D Sapphire Skill Button Base (skill_btn_bg.png, 281x207)
    sbtn = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sbtn)
    sd.rounded_rectangle([6, 16, 275, 203], radius=34, fill=(23, 78, 166, 255))
    sbody = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    sbd = ImageDraw.Draw(sbody)
    for y in range(6, 188):
        t = (y - 6) / 182.0
        r = int(96 - 58 * t)
        g = int(188 - 64 * t)
        b = int(255 - 20 * t)
        sbd.line([(0, y), (281, y)], fill=(r, g, b, 255))
    smask = Image.new("L", (281, 207), 0)
    ImageDraw.Draw(smask).rounded_rectangle([8, 6, 273, 188], radius=32, fill=255)
    sbtn.paste(sbody, (0, 0), smask)
    sspec = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    ImageDraw.Draw(sspec).rounded_rectangle([22, 14, 259, 86], radius=22, fill=(255, 255, 255, 76))
    sbtn.alpha_composite(sspec)
    sd.rounded_rectangle([8, 6, 273, 188], radius=32, outline=(255, 255, 255, 215), width=4)
    sbtn.save(os.path.join(UI_ORIG_DIR, "skill_btn_bg.png"))

    # 10. Clean sparkling touch Spine atlas (straight alpha, golden-white stars!)
    if os.path.exists(TOUCH_PNG):
        t_im = Image.open(TOUCH_PNG).convert("RGBA")
        tw, th = t_im.size
        clean = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        cd = ImageDraw.Draw(clean)
        # Bright golden-white sparkle burst centered in the atlas region
        cx, cy = tw // 2, th // 2
        for rad, alp in [(min(tw, th) // 2 - 4, 45), (min(tw, th) // 3, 120), (min(tw, th) // 5, 220)]:
            cd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 248, 196, alp))
        clean = clean.filter(ImageFilter.GaussianBlur(3))
        clean.save(TOUCH_PNG)


def main():
    make_3d_screws()
    make_3d_boxes_and_lids()
    b_count = make_glossy_acrylic_boards()
    make_3d_ui_and_backgrounds()
    print(f"AAA 3D art composite complete: 11 3D screws + shaft, 11 3D boxes + 10 lids, locked box, {b_count} glossy acrylic boards, 3D UI & backgrounds!")


if __name__ == "__main__":
    main()
