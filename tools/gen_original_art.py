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
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont

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

# Scheme A: Royal Candy (Classic Overseas Casual - 10 maximally distinct colors)
# Source master is vivid crimson red (hue ~ 0.0 / 0.99)
COLOR_TARGETS = {
    0:  (0.60, 0.10, 0.95),  # Neutral Silver (fallback)
    1:  (0.99, 1.05, 1.02),  # 1: Red
    2:  (0.14, 1.08, 1.38),  # 2: Yellow
    3:  (0.37, 1.02, 0.98),  # 3: Green
    4:  (0.62, 1.05, 1.02),  # 4: Blue
    5:  (0.77, 0.96, 1.06),  # 5: Purple
    6:  (0.072, 1.08, 1.25), # 6: Orange
    7:  (0.91, 0.68, 1.34),  # 7: Pink
    8:  (0.51, 0.88, 1.28),  # 8: Cyan
    9:  (0.58, 0.04, 1.44),  # 9: Pearl White
    10: (0.60, 0.12, 0.40),  # 10: Black
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

    # Holding tray hole & upgraded 3D titanium '+1 Slot' icon (gbz_screw_core.png)
    hole_big = draw_3d_socket_hole(72)
    hole_big.save(os.path.join(GAMES_DIR, "hole.png"))

    def make_3d_add_slot_icon():
        S = 160
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        # Soft drop shadow
        sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([20, 26, 140, 146], fill=(15, 23, 42, 75))
        sh = sh.filter(ImageFilter.GaussianBlur(5))
        im.alpha_composite(sh)
        # Outer machined chrome/titanium 3D ring (vertical metallic gradient)
        ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        for y in range(18, 138):
            t = (y - 18) / 120.0
            v = int(248 - 105 * t + 32 * math.sin(t * math.pi * 2))
            v = max(120, min(255, v))
            rd.line([(18, y), (138, y)], fill=(v, min(255, v + 4), min(255, v + 12), 255))
        rmask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(rmask).ellipse([18, 18, 138, 138], fill=255)
        im.paste(ring, (0, 0), rmask)
        d.ellipse([18, 18, 138, 138], outline=(100, 116, 139, 255), width=3)
        # Inner bright chamfer + deep recessed navy-steel socket
        d.ellipse([34, 34, 122, 122], fill=(30, 41, 59, 255), outline=(226, 232, 240, 220), width=3)
        d.arc([36, 36, 120, 120], start=195, end=345, fill=(10, 15, 28, 230), width=6)
        d.arc([38, 38, 118, 118], start=25, end=155, fill=(100, 116, 139, 170), width=4)
        # Crisp glossy golden '+' emblem nested in lower-right of socket!
        d.ellipse([96, 94, 148, 146], fill=(245, 158, 11, 255), outline=(255, 255, 255, 255), width=4)
        d.rectangle([118, 106, 126, 134], fill=(255, 255, 255, 255))
        d.rectangle([108, 116, 136, 124], fill=(255, 255, 255, 255))
        return im.resize((128, 128), Image.Resampling.LANCZOS)

    slot_ico = make_3d_add_slot_icon()
    slot_ico.save(os.path.join(UI_ORIG_DIR, "gbz_screw_core.png"))
    slot_ico.save(os.path.join(GAMES_DIR, "gbz_screw_core.png"))


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

    # 9. Royal-Match Style Pearl-Ivory 3D Ceramic Skill Button Base (skill_btn_bg.png, 281x207)
    sbtn = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    # Soft ambient drop shadow
    sh = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([12, 22, 269, 200], radius=38, fill=(30, 58, 138, 68))
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    sbtn.alpha_composite(sh)

    sd = ImageDraw.Draw(sbtn)
    # Cool silver-blue 3D extruded bottom lip
    sd.rounded_rectangle([10, 16, 271, 194], radius=36, fill=(148, 163, 184, 255))
    # Pearl-white to soft-ice vertical ceramic body
    sbody = Image.new("RGBA", (281, 207), (0, 0, 0, 0))
    sbd = ImageDraw.Draw(sbody)
    for y in range(6, 182):
        t = (y - 6) / 176.0
        r = int(255 - 18 * t)
        g = int(255 - 13 * t)
        b = int(255 - 3 * t)
        sbd.line([(0, y), (281, y)], fill=(r, g, b, 255))
    smask = Image.new("L", (281, 207), 0)
    ImageDraw.Draw(smask).rounded_rectangle([10, 6, 271, 182], radius=36, fill=255)
    sbtn.paste(sbody, (0, 0), smask)

    # Subtle recessed sky-tint cradle behind icon
    sd.rounded_rectangle([24, 18, 257, 134], radius=24, fill=(224, 242, 254, 155))
    # Sleek sapphire-blue bottom nameplate ribbon for ultra-crisp label readability
    sd.rounded_rectangle([24, 128, 257, 174], radius=18, fill=(37, 99, 235, 255))
    sd.rounded_rectangle([28, 130, 253, 148], radius=12, fill=(96, 165, 250, 120))
    # Crisp white outer rim highlight
    sd.rounded_rectangle([10, 6, 271, 182], radius=36, outline=(255, 255, 255, 245), width=4)
    sbtn.save(os.path.join(UI_ORIG_DIR, "skill_btn_bg.png"))

    # 9b. Glossy 3D Count Badge (Emerald Green Circle) & AD Badge (Warm Amber Pill)
    def make_3d_badge(w, h, top_c, bot_c, sh_c):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        bsh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(bsh).rounded_rectangle([4, 8, w - 4, h - 2], radius=h // 2, fill=(15, 23, 42, 80))
        bsh = bsh.filter(ImageFilter.GaussianBlur(3))
        im.alpha_composite(bsh)
        bd = ImageDraw.Draw(im)
        bd.rounded_rectangle([4, 6, w - 4, h - 4], radius=(h - 10) // 2, fill=(*sh_c, 255))
        grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for y in range(4, h - 8):
            t = (y - 4) / max(1, h - 12)
            c = tuple(int(top_c[i] * (1 - t) + bot_c[i] * t) for i in range(3))
            gd.line([(0, y), (w, y)], fill=(*c, 255))
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle([5, 4, w - 5, h - 8], radius=(h - 12) // 2, fill=255)
        im.paste(grad, (0, 0), m)
        sp = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sp).rounded_rectangle([12, 7, w - 12, h // 2 - 2], radius=12, fill=(255, 255, 255, 95))
        im.alpha_composite(sp)
        bd.rounded_rectangle([5, 4, w - 5, h - 8], radius=(h - 12) // 2, outline=(255, 255, 255, 255), width=4)
        return im

    make_3d_badge(76, 76, (52, 211, 153), (16, 185, 129), (5, 150, 105)).save(os.path.join(UI_ORIG_DIR, "badge_count.png"))
    make_3d_badge(96, 70, (251, 191, 36), (234, 88, 12), (180, 83, 9)).save(os.path.join(UI_ORIG_DIR, "badge_ad.png"))

    # 10. 4x Supersampled 3D Extruded Golden Logo ("SCREW JAM")
    def make_3d_logo():
        W, H = 560, 128
        S = 2
        im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", 76 * S)
        except Exception:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 76 * S)
            except Exception:
                font = ImageFont.load_default()
        txt = "SCREW JAM"
        bbox = d.textbbox((0, 0), txt, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (W * S - tw) // 2 - bbox[0]
        ty = (H * S - th) // 2 - bbox[1] - 6

        # Deep 3D navy extrusion layers
        for dy in range(18, 0, -2):
            d.text((tx, ty + dy), txt, font=font, fill=(20, 48, 112, 255), stroke_width=14, stroke_fill=(20, 48, 112, 255))
        # Crisp white inner rim
        d.text((tx, ty), txt, font=font, fill=(255, 255, 255, 255), stroke_width=8, stroke_fill=(255, 255, 255, 255))
        # Warm sunny gold-to-orange gradient fill mask
        tmask = Image.new("L", (W * S, H * S), 0)
        ImageDraw.Draw(tmask).text((tx, ty), txt, font=font, fill=255)
        grad = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for y in range(H * S):
            u = max(0.0, min(1.0, (y - ty) / max(1, th)))
            r = 255
            g = int(244 - 92 * u)
            b = int(92 - 78 * u)
            gd.line([(0, y), (W * S, y)], fill=(r, g, b, 255))
        im.paste(grad, (0, 0), tmask)
        # Top glossy specular highlight band on letters
        shine = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        ImageDraw.Draw(shine).rectangle([0, ty, W * S, ty + int(th * 0.42)], fill=(255, 255, 255, 72))
        im.paste(shine, (0, 0), tmask)
        im.resize((W, H), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "logo_screw_jam.png"))

    # 11. Glossy 3D Squircle Menu Icons (Gallery Palette, Daily Star Calendar, Gold Trophy)
    def make_glossy_squircle(top_rgb, bot_rgb, shadow_rgb):
        W, H = 160, 148
        base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(base)
        d.rounded_rectangle([6, 14, W - 6, H - 4], radius=32, fill=(*shadow_rgb, 255))
        grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for y in range(6, H - 14):
            t = (y - 6) / max(1, (H - 20))
            c = tuple(int(top_rgb[i] * (1 - t) + bot_rgb[i] * t) for i in range(3))
            gd.line([(0, y), (W, y)], fill=(*c, 255))
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).rounded_rectangle([8, 6, W - 8, H - 14], radius=30, fill=255)
        base.paste(grad, (0, 0), mask)
        spec = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(spec).rounded_rectangle([18, 12, W - 18, 56], radius=18, fill=(255, 255, 255, 76))
        base.alpha_composite(spec)
        d.rounded_rectangle([8, 6, W - 8, H - 14], radius=30, outline=(255, 255, 255, 210), width=3)
        return base

    # Gallery icon (purple glossy squircle + 4 colorful mini 3D screws arranged as a mosaic!)
    gal = make_glossy_squircle((168, 85, 247), (109, 40, 217), (76, 29, 149))
    for (sx, sy, cid) in [(48, 28, 1), (82, 28, 2), (48, 62, 3), (82, 62, 4)]:
        sp = os.path.join(GAMES_DIR, f"gbz_screw{cid}.png")
        if os.path.exists(sp):
            ms = Image.open(sp).convert("RGBA").resize((32, 32), Image.Resampling.LANCZOS)
            gal.alpha_composite(ms, (sx, sy))
    gal.save(os.path.join(UI_ORIG_DIR, "icon_menu_gallery.png"))

    # Daily icon (coral-orange glossy squircle + 3D golden star coin!)
    daily = make_glossy_squircle((251, 146, 60), (234, 88, 12), (154, 52, 18))
    coin_sm = coin_cut.resize((72, 72), Image.Resampling.LANCZOS)
    daily.alpha_composite(coin_sm, (44, 24))
    daily.save(os.path.join(UI_ORIG_DIR, "icon_menu_daily.png"))

    # Ranking icon (royal-blue glossy squircle + 3D golden trophy cup!)
    rank = make_glossy_squircle((56, 189, 248), (2, 132, 199), (12, 74, 110))
    rd = ImageDraw.Draw(rank)
    # Golden trophy cup silhouette with warm 3D highlight
    rd.arc([38, 32, 68, 66], start=90, end=270, fill=(250, 204, 21, 255), width=6)
    rd.arc([92, 32, 122, 66], start=270, end=90, fill=(250, 204, 21, 255), width=6)
    rd.rounded_rectangle([50, 24, 110, 72], radius=16, fill=(250, 204, 21, 255), outline=(180, 83, 9, 255), width=3)
    rd.rounded_rectangle([58, 30, 84, 52], radius=8, fill=(254, 249, 195, 160))
    rd.rectangle([72, 70, 88, 84], fill=(234, 179, 8, 255))
    rd.rounded_rectangle([54, 82, 106, 94], radius=5, fill=(180, 83, 9, 255), outline=(253, 224, 71, 255), width=2)
    rank.save(os.path.join(UI_ORIG_DIR, "icon_menu_rank.png"))

    make_3d_logo()

    # 12. Clean sparkling touch Spine atlas (straight alpha, golden-white stars!)
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
