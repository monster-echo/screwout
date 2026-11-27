#!/usr/bin/env python3
"""
Sweet Candy & Frosted Cookie Skin Pipeline for ScrewOut.
Upgrades the single unified default skin to match a luscious candy-bakery aesthetic:
- 11 translucent gummy-candy 3D screws (from studio 3D master) + tintable candy threaded shaft
- 11 open 3D macaron pastry boxes (preserving vanilla piped cream trim + satin bow) + 3 cookie sockets
- 10 closed ribbon-topped macaron pastry lids with glazed heart cookie charm
- Locked strawberry-pink macaron box with piped cream stripe & studio 3D golden padlock
- All 120 board sprites (60 baked golden butter-cookie frames + 60 puffy glossy royal-icing fills)
- Dreamy pastel strawberry-pink patisserie backdrops & 3D scalloped pink cake-stand top deck
- 4x-supersampled 3D glossy golden-yellow & hot-pink candy logo + satin ribbon banner
- Complete cohesive candy UI chrome (skill cards, candy icons, buttons, popup frame, bakery box)
"""
import colorsys
import glob
import json
import math
import os
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = "/Users/echo/workspace/CocosGames/ScrewOut"
BRAIN_CUR = "/Users/echo/.gemini/antigravity/brain/19cada57-8d69-4a53-a828-ff66ee06438a"
BRAIN_PREV = "/Users/echo/.gemini/antigravity/brain/9d137123-917d-47de-ae09-97bdac13be55"

GAMES_DIR = os.path.join(ROOT, "assets/resources/sprites/games")
UI_ORIG_DIR = os.path.join(ROOT, "assets/resources/sprites/ui_orig")
BOARDS_DIR = os.path.join(ROOT, "assets/resources/sprites/boards")
DESSERT_DIR = os.path.join(ROOT, "assets/resources/sprites/themes/dessert")

SRC_SCREW_RED = os.path.join(BRAIN_CUR, "candy_screw_red_1795790142173.jpg")
SRC_BOX_RED = os.path.join(BRAIN_CUR, "macaron_box_red_open_1795790146923.jpg")
SRC_BG_CANDY = os.path.join(BRAIN_CUR, "bg_sweet_candy_1795790152832.jpg")
SRC_PADLOCK = os.path.join(BRAIN_PREV, "padlock_3d_1795665769090.jpg")

os.makedirs(DESSERT_DIR, exist_ok=True)

# 10 maximally distinct juicy gummy-candy colors (target_h, sat_mul, val_mul)
CANDY_COLORS = {
    0:  (0.60, 0.08, 1.05),  # Pearl neutral fallback
    1:  (0.992, 1.08, 1.08), # 1: Cherry Gummy Red
    2:  (0.132, 1.12, 1.38), # 2: Lemon-Honey Candy Yellow
    3:  (0.365, 1.02, 1.06), # 3: Apple-Mint Candy Green
    4:  (0.595, 1.04, 1.12), # 4: Blueberry Soda Blue
    5:  (0.775, 0.96, 1.14), # 5: Grape Gummy Purple
    6:  (0.068, 1.12, 1.28), # 6: Tangerine Candy Orange
    7:  (0.918, 0.78, 1.34), # 7: Strawberry Bubblegum Pink
    8:  (0.478, 0.95, 1.22), # 8: Mint-Teal Gummy Cyan
    9:  (0.10,  0.10, 1.48), # 9: Vanilla Cream Pearl
    10: (0.062, 0.52, 0.56), # 10: Rich Glossy Cocoa Chocolate
}


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def flood_remove_white_bg(img: Image.Image, thresh: int = 234, feather: float = 0.8) -> Image.Image:
    im = img.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    q = deque()

    def is_bg(r, g, b):
        return r >= thresh and g >= thresh and b >= thresh and (max(r, g, b) - min(r, g, b)) <= 24

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

    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        off = y * w
        for x in range(w):
            if visited[off + x]:
                apx[x, y] = 0
                px[x, y] = (0, 0, 0, 0)

    if feather > 0:
        alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(feather))
    im.putalpha(alpha)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


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


def grade_candy_screw(master: Image.Image, color_id: int) -> Image.Image:
    th, sm, vm = CANDY_COLORS[color_id]
    src = master.convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h))
    spx = src.load()
    opx = out.load()
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    R = min(w, h) * 0.48

    for y in range(h):
        dy = (y - cy) / R
        for x in range(w):
            r, g, b, a = spx[x, y]
            if a == 0:
                opx[x, y] = (0, 0, 0, 0)
                continue
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hh, ss, vv = colorsys.rgb_to_hsv(rf, gf, bf)

            # Pure crisp specular white highlights stay neutral white
            if ss < 0.14 and vv > 0.62:
                v2 = clamp(vv * 255)
                opx[x, y] = (v2, v2, v2, a)
                continue

            # Subtle gummy subsurface glow in lower-right quadrant
            dx = (x - cx) / R
            dist = min(1.0, math.sqrt(dx * dx + dy * dy))
            subsurf = max(0.0, dx * 0.42 + dy * 0.52 + 0.20) * dist * 0.14

            if color_id == 9:
                # Warm vanilla-pearl candy: creamy bright dome, subtle caramel depth in cross slot
                new_v = min(1.0, (vv ** 0.72) * 1.18 + 0.08)
                new_s = max(0.03, (1.0 - new_v) * 0.28 + 0.04)
                nr, ng, nb = colorsys.hsv_to_rgb(0.09, new_s, new_v)
                opx[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
            elif color_id == 10:
                # Rich glossy milk/dark chocolate candy
                new_v = min(1.0, (vv ** 0.92) * 0.58 + subsurf * 0.45)
                new_s = min(0.68, ss * 0.62)
                nr, ng, nb = colorsys.hsv_to_rgb(0.062, new_s, new_v)
                if ss < 0.28 and vv > 0.52:
                    # Keep specular highlights crisp warm cream
                    t_spec = max(0.0, min(1.0, (0.28 - ss) / 0.14))
                    nr = nr * (1 - t_spec) + vv * t_spec
                    ng = ng * (1 - t_spec) + vv * 0.97 * t_spec
                    nb = nb * (1 - t_spec) + vv * 0.92 * t_spec
                opx[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
            else:
                blend = min(1.0, max(0.0, (ss - 0.12) / 0.16))
                new_s = min(1.0, ss * (1.0 - blend + blend * sm))
                new_v = min(1.0, (vv ** 0.85) * (1.0 - blend + blend * vm) + subsurf * blend)
                nr, ng, nb = colorsys.hsv_to_rgb(th, new_s, new_v)
                r2 = vv * (1.0 - blend) + nr * blend
                g2 = vv * (1.0 - blend) + ng * blend
                b2 = vv * (1.0 - blend) + nb * blend
                opx[x, y] = (clamp(r2 * 255), clamp(g2 * 255), clamp(b2 * 255), a)
    return bleed_transparent_rgb(out, passes=5)


def make_gummy_screws_and_shaft():
    print("1) Building 11 glossy gummy-candy 3D screws + tintable candy threaded shaft...")
    raw = Image.open(SRC_SCREW_RED)
    cut = flood_remove_white_bg(raw, thresh=232, feather=0.0)
    side = max(cut.width, cut.height)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2), cut)

    master_hi = sq.resize((256, 256), Image.Resampling.LANCZOS)
    circ_hi = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(circ_hi).ellipse([20, 20, 492, 492], fill=255)
    master_hi.putalpha(circ_hi.resize((256, 256), Image.Resampling.LANCZOS))
    master = master_hi.resize((128, 128), Image.Resampling.LANCZOS)

    for idx in range(11):
        im = grade_candy_screw(master, idx)
        im.save(os.path.join(DESSERT_DIR, f"dessert_screw{idx}.png"))
        im.save(os.path.join(GAMES_DIR, f"gbz_screw{idx}.png"))

    # Neutral bright-white glossy 3D gummy threaded screw shaft (tinted per colorId at runtime!)
    W, H = 48, 112
    shaft = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    spx = shaft.load()
    for y in range(4, 106):
        t = (y - 4) / 102.0
        # Plump rounded gummy candy screw shaft with soft rounded tip
        half_w = 15.0 * (1.0 - 0.14 * (t ** 2.0))
        if y > 92:
            half_w *= max(0.18, math.cos(((y - 92) / 14.0) * math.pi * 0.48))
        # Subtle helical bulging silhouette on left/right edges
        bulge = 1.6 * math.sin(y * 0.46)
        hw = half_w + bulge
        x0 = max(1, int(W / 2 - hw))
        x1 = min(W - 2, int(W / 2 + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, (x1 - x0))
            # Smooth glossy gummy cylinder shading + bright specular highlight on left-center
            cyl = 0.62 + 0.38 * math.exp(-((u - 0.32) / 0.26) ** 2) - 0.22 * ((u - 0.5) ** 2)
            ridge = math.sin(y * 0.46 + u * 2.1)
            lum = clamp((216 + 38 * ridge) * cyl, 105, 255)
            # Crisp glossy highlight strip
            if 0.22 <= u <= 0.36 and ridge > 0.2:
                lum = clamp(lum + 26, 105, 255)
            spx[x, y] = (lum, lum, lum, 255)
    shaft = bleed_transparent_rgb(shaft, passes=3)
    shaft.save(os.path.join(GAMES_DIR, "screw_shaft.png"))


def draw_cookie_socket_hole(size: int, style: str = "board") -> Image.Image:
    """
    4x-supersampled warm baked-cookie / caramel-cream recessed screw socket.
    style='board': toasted golden cookie hole for frosted sugar-cookie boards (hole.png)
    style='box': warm caramel-cream socket inside the macaron pastry boxes
    style='tray': plump golden-biscuit rim + berry-cocoa recessed cup for holding tray
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
            a = 255 if r <= 0.96 else clamp((1.02 - r) / 0.06 * 255)
            if a == 0:
                continue

            if style == "board":
                # Warm golden toasted cookie rim around deep warm amber-cocoa hole
                if r >= 0.72:
                    t = (r - 0.72) / 0.28
                    bevel = math.sin(t * math.pi)
                    light = max(0.0, -dx * 0.5 - dy * 0.65)
                    cr = clamp(232 + 20 * bevel + 14 * light - 32 * (t ** 2))
                    cg = clamp(168 + 26 * bevel + 12 * light - 42 * (t ** 2))
                    cb = clamp(82 + 24 * bevel + 8 * light - 34 * (t ** 2))
                    px[x, y] = (cr, cg, cb, a)
                else:
                    t = r / 0.72
                    ao = max(0.0, (-dx * 0.45 - dy * 0.65 + 0.35)) * (t ** 1.6)
                    bounce = max(0.0, (dx * 0.45 + dy * 0.55)) * (t ** 1.3)
                    cr = clamp(152 - 58 * ao + 46 * bounce)
                    cg = clamp(88 - 44 * ao + 34 * bounce)
                    cb = clamp(62 - 32 * ao + 24 * bounce)
                    px[x, y] = (cr, cg, cb, a)
            elif style == "box":
                # Soft rose-caramel rim + warm berry-cocoa recessed hole inside ivory pastry tray
                if r >= 0.74:
                    t = (r - 0.74) / 0.26
                    bevel = math.sin(t * math.pi)
                    light = max(0.0, -dx * 0.5 - dy * 0.6)
                    cr = clamp(228 + 22 * bevel + 14 * light - 22 * t)
                    cg = clamp(192 + 22 * bevel + 12 * light - 26 * t)
                    cb = clamp(158 + 18 * bevel + 10 * light - 24 * t)
                    px[x, y] = (cr, cg, cb, a)
                else:
                    t = r / 0.74
                    ao = max(0.0, (-dx * 0.45 - dy * 0.65 + 0.32)) * (t ** 1.6)
                    bounce = max(0.0, (dx * 0.45 + dy * 0.55)) * (t ** 1.3)
                    cr = clamp(114 - 44 * ao + 32 * bounce)
                    cg = clamp(74 - 32 * ao + 24 * bounce)
                    cb = clamp(84 - 30 * ao + 24 * bounce)
                    px[x, y] = (cr, cg, cb, a)
            else:
                # Holding tray: plump golden butter-cookie rim + warm berry-rose cocoa well
                if r >= 0.68:
                    t = (r - 0.68) / 0.32
                    bevel = math.sin(t * math.pi)
                    light = max(0.0, -dx * 0.55 - dy * 0.65)
                    cr = clamp(244 + 14 * bevel + 14 * light - 34 * (t ** 2))
                    cg = clamp(196 + 24 * bevel + 14 * light - 44 * (t ** 2))
                    cb = clamp(134 + 28 * bevel + 12 * light - 46 * (t ** 2))
                    px[x, y] = (cr, cg, cb, a)
                else:
                    t = r / 0.68
                    ao = max(0.0, (-dx * 0.5 - dy * 0.65 + 0.35)) * (t ** 1.7)
                    bounce = max(0.0, (dx * 0.45 + dy * 0.55)) * (t ** 1.3)
                    cr = clamp(128 - 48 * ao + 34 * bounce)
                    cg = clamp(82 - 36 * ao + 26 * bounce)
                    cb = clamp(96 - 34 * ao + 26 * bounce)
                    px[x, y] = (cr, cg, cb, a)

    out = im.resize((size, size), Image.Resampling.LANCZOS)
    return bleed_transparent_rgb(out, passes=3)


def selective_grade_macaron_box(master: Image.Image, color_id: int) -> Image.Image:
    """
    Grades ONLY the cherry-red enamel shell & glossy satin bow to the target candy color,
    preserving 100% of the piped vanilla buttercream trim and smooth warm ivory inner panel!
    """
    th, sm, vm = CANDY_COLORS[color_id]
    src = master.convert("RGBA")
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

            # Detect cherry-red enamel shell & bow (reddish hue + notable saturation)
            # Vanilla buttercream has hue ~ 0.08..0.15 and ss < 0.34
            is_red_hue = (hh >= 0.88 or hh <= 0.058)
            if is_red_hue and ss >= 0.30:
                blend = min(1.0, (ss - 0.28) / 0.18)
                # Also fade softly near hue boundary 0.058
                if hh <= 0.058:
                    h_blend = min(1.0, max(0.0, (0.058 - hh) / 0.025))
                    blend *= h_blend
                if color_id == 9:
                    # Pearl-white frosted shell with subtle icy-lavender edge contrast
                    nr, ng, nb = colorsys.hsv_to_rgb(0.60, 0.06, min(1.0, (vv ** 0.72) * 1.24 + 0.14))
                elif color_id == 10:
                    # Rich glossy dark chocolate glaze shell
                    nr, ng, nb = colorsys.hsv_to_rgb(0.062, min(0.58, ss * 0.58), min(1.0, (vv ** 0.90) * 0.54 + 0.03))
                else:
                    new_s = min(1.0, ss * sm)
                    new_v = min(1.0, (vv ** 0.86) * vm)
                    nr, ng, nb = colorsys.hsv_to_rgb(th, new_s, new_v)
                r2 = rf * (1.0 - blend) + nr * blend
                g2 = gf * (1.0 - blend) + ng * blend
                b2 = bf * (1.0 - blend) + nb * blend
                opx[x, y] = (clamp(r2 * 255), clamp(g2 * 255), clamp(b2 * 255), a)
            else:
                # Keep warm vanilla buttercream piping & ivory center pristine!
                opx[x, y] = (r, g, b, a)
    return bleed_transparent_rgb(out, passes=4)


def draw_heart_cookie_charm(size: int) -> Image.Image:
    """Cute 4x-supersampled plump glazed heart sugar-cookie charm (golden rim + pink icing + gloss)."""
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = im.load()
    cx, cy = S * 0.5, S * 0.49
    scale = S * 0.35

    for y in range(S):
        ny = -(y - cy) / scale
        for x in range(S):
            nx = (x - cx) / scale
            # Classic plump heart curve (wider smooth bottom, rounder lobes)
            ax = abs(nx)
            yy = ny - 0.52 * math.sqrt(max(0.0, ax))
            d2 = ax * ax + yy * yy
            # Smooth heart SDF-like radius (<= 1.0 inside)
            r = math.sqrt(d2)
            if r > 1.14:
                continue
            if r > 0.90:
                a = 255 if r <= 1.08 else clamp((1.14 - r) / 0.06 * 255)
                t = max(0.0, min(1.0, (r - 0.90) / 0.22))
                cr = clamp(244 - 44 * t)
                cg = clamp(178 - 54 * t)
                cb = clamp(92 - 42 * t)
                px[x, y] = (cr, cg, cb, a)
            else:
                gloss = max(0.0, -nx * 0.45 + ny * 0.65)
                spec = 1.0 if (nx < -0.10 and ny > 0.22 and r < 0.72 and r > 0.42) else 0.0
                cr = 255
                cg = clamp(128 + 64 * gloss + 55 * spec)
                cb = clamp(178 + 48 * gloss + 48 * spec)
                px[x, y] = (cr, cg, cb, 255)
    return im.resize((size, size), Image.Resampling.LANCZOS)


def make_macaron_boxes_and_lids():
    print("2) Building 11 3D macaron pastry boxes, 10 ribbon-topped lids, and locked pink macaron box...")
    raw_box = Image.open(SRC_BOX_RED)
    cut_box = flood_remove_white_bg(raw_box, thresh=234, feather=0.7)
    # Fit snugly into 164x212 (TargetBox exact aspect ratio)
    box_master = cut_box.resize((164, 212), Image.Resampling.LANCZOS)

    hole_box = draw_cookie_socket_hole(38, style="box")
    # Aligned with TargetBox.ts slotPositions: [0, 14], [-27, -34], [27, -34]
    # Center of 164x212 is (82, 106). Scale factor 212/204 ~ 1.039, 164/156 ~ 1.051
    # slot_0: (82, 106 - 14.5) = (82, 91)
    # slot_1: (82 - 28.4, 106 + 35.3) = (54, 141)
    # slot_2: (82 + 28.4, 106 + 35.3) = (110, 141)
    socket_centers = [(82, 92), (54, 141), (110, 141)]
    heart_charm = draw_heart_cookie_charm(46)

    for idx in range(11):
        graded = selective_grade_macaron_box(box_master, idx)

        # Open pastry box with 3 warm caramel recessed sockets
        open_box = graded.copy()
        for (sx, sy) in socket_centers:
            open_box.alpha_composite(hole_box, (sx - 19, sy - 19))
        open_box.save(os.path.join(DESSERT_DIR, f"dessert_box{idx}.png"))
        open_box.save(os.path.join(GAMES_DIR, f"gbz_box{idx}.png"))

        # Closed frosted pastry lid (dessert_cover1..10 & gbz_cover1..10)
        if idx >= 1:
            lid = graded.copy()
            # Sample the graded shell color near top-left edge
            th, sm, vm = CANDY_COLORS[idx]
            if idx == 9:
                c_top, c_bot = (255, 250, 245), (236, 224, 215)
            elif idx == 10:
                c_top, c_bot = (132, 82, 54), (78, 44, 26)
            else:
                r1, g1, b1 = colorsys.hsv_to_rgb(th, min(1.0, 0.56 * sm), min(1.0, 0.96 * min(1.05, vm)))
                r2, g2, b2 = colorsys.hsv_to_rgb(th, min(1.0, 0.80 * sm), min(1.0, 0.78 * min(1.05, vm)))
                c_top = (clamp(r1 * 255), clamp(g1 * 255), clamp(b1 * 255))
                c_bot = (clamp(r2 * 255), clamp(g2 * 255), clamp(b2 * 255))

            # Plump glossy domed pastry lid filling the ENTIRE inner cream window [29, 28, 135, 189]
            dome = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
            dd = ImageDraw.Draw(dome)
            for y in range(28, 190):
                t = (y - 28) / 162.0
                col = tuple(clamp(c_top[k] * (1 - t) + c_bot[k] * t) for k in range(3))
                dd.line([(29, y), (135, y)], fill=(*col, 255))
            dmask = Image.new("L", (164, 212), 0)
            ImageDraw.Draw(dmask).rounded_rectangle([29, 28, 135, 189], radius=16, fill=255)
            lid.paste(dome, (0, 0), dmask)

            # Soft glossy curved icing sheen + delicate satin ribbon stripe across lid
            gloss = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
            gd = ImageDraw.Draw(gloss)
            gd.rounded_rectangle([36, 36, 128, 86], radius=14, fill=(255, 255, 255, 76))
            gd.rectangle([72, 28, 92, 189], fill=(255, 255, 255, 58))
            gd.rounded_rectangle([29, 28, 135, 189], radius=16, outline=(255, 255, 255, 165), width=2)
            lid.alpha_composite(gloss)
            # Re-paste top bow & upper piped cream cleanly over top edge of dome!
            bow_strip = graded.crop((0, 0, 164, 38))
            lid.alpha_composite(bow_strip, (0, 0))
            # Cute glazed heart sugar-cookie charm centered on lid!
            lid.alpha_composite(heart_charm, (82 - 23, 112 - 23))

            lid.save(os.path.join(DESSERT_DIR, f"dessert_cover{idx}.png"))
            lid.save(os.path.join(GAMES_DIR, f"gbz_cover{idx}.png"))

    # Locked box: Strawberry-pink macaron pastry box + piped cream wave + studio 3D golden padlock!
    pink_box = selective_grade_macaron_box(box_master, 7)  # Strawberry pink
    # Fill ENTIRE inner cavity [29, 28, 135, 189] with lush strawberry-pink macaron cushion
    cushion = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cushion)
    for y in range(28, 190):
        t = (y - 28) / 162.0
        r = clamp(255 - 14 * t)
        g = clamp(154 - 50 * t)
        b = clamp(194 - 38 * t)
        cd.line([(29, y), (135, y)], fill=(r, g, b, 255))
    cmask = Image.new("L", (164, 212), 0)
    ImageDraw.Draw(cmask).rounded_rectangle([29, 28, 135, 189], radius=16, fill=255)
    pink_box.paste(cushion, (0, 0), cmask)

    # Horizontal piped vanilla buttercream filling scallops neatly inside cavity
    cream = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
    crd = ImageDraw.Draw(cream)
    for sx in range(38, 128, 16):
        crd.ellipse([sx - 8, 108, sx + 8, 126], fill=(255, 245, 224, 240), outline=(235, 206, 174, 200), width=1)
    crd.rounded_rectangle([36, 38, 128, 84], radius=14, fill=(255, 255, 255, 68))
    pink_box.alpha_composite(cream)
    # Re-paste top pink bow cleanly over cushion top!
    pink_bow = selective_grade_macaron_box(box_master, 7).crop((0, 0, 164, 38))
    pink_box.alpha_composite(pink_bow, (0, 0))
    pink_box.alpha_composite(heart_charm.resize((32, 32), Image.Resampling.LANCZOS), (82 - 16, 18))

    # Composite real studio 3D golden padlock!
    if os.path.exists(SRC_PADLOCK):
        lock_raw = Image.open(SRC_PADLOCK)
        lock_cut = flood_remove_white_bg(lock_raw, thresh=232, feather=0.7)
        lock_im = lock_cut.resize((84, 96), Image.Resampling.LANCZOS)
        # Soft warm shadow behind padlock
        lsh = Image.new("RGBA", (164, 212), (0, 0, 0, 0))
        ImageDraw.Draw(lsh).ellipse([44, 96, 120, 174], fill=(138, 34, 72, 95))
        lsh = lsh.filter(ImageFilter.GaussianBlur(5))
        pink_box.alpha_composite(lsh)
        pink_box.alpha_composite(lock_im, ((164 - 84) // 2, 74))

    # Crisp candy golden-mint '+' unlock badge in upper-right corner
    bd = ImageDraw.Draw(pink_box)
    bd.ellipse([122, 30, 158, 66], fill=(52, 211, 153, 255), outline=(255, 255, 255, 255), width=3)
    bd.rectangle([137, 39, 143, 57], fill=(255, 255, 255, 255))
    bd.rectangle([131, 45, 149, 51], fill=(255, 255, 255, 255))

    pink_box.save(os.path.join(DESSERT_DIR, "dessert_box_locked.png"))
    pink_box.save(os.path.join(UI_ORIG_DIR, "box_locked.png"))

    # Board screw holes & holding tray sockets
    draw_cookie_socket_hole(72, style="board").save(os.path.join(GAMES_DIR, "hole.png"))
    tray_hole = draw_cookie_socket_hole(96, style="tray")
    tray_hole.save(os.path.join(DESSERT_DIR, "dessert_hole.png"))
    tray_hole.save(os.path.join(UI_ORIG_DIR, "gbz_screw_core.png"))
    tray_hole.save(os.path.join(GAMES_DIR, "gbz_screw_core.png"))


def bake_frosted_cookie_boards():
    """
    Transforms all 120 board sprites (60 outer frames + 60 inner fills) into luscious
    baked golden-brown sugar cookies topped with thick puffy glossy royal icing!
    100% pixel-aligned with original Box2D colliders & screw hole positions.
    """
    print("3) Baking all 120 board sprites into golden butter-cookies + puffy glossy sugar icing...")
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

    # 3A. Bake 60 outer frame sprites -> warm toasted golden-brown butter-cookie crust!
    f_cnt = 0
    for name in sorted(frame_names):
        path = os.path.join(BOARDS_DIR, f"{name}.png")
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        alpha = im.getchannel("A")

        # Soft interior distance approximation to give toasted outer edge & plump biscuit bevel
        e1 = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(3))
        e2 = alpha.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(5))
        apx = alpha.load()
        e1px = e1.load()
        e2px = e2.load()

        out = Image.new("RGBA", (w, h), (225, 152, 68, 0))
        opx = out.load()

        for y in range(h):
            ty = y / max(1, h - 1)
            for x in range(w):
                a = apx[x, y]
                if a < 18:
                    opx[x, y] = (212, 138, 56, 0)
                    continue
                tx = x / max(1, w - 1)
                # Rim factor: 1 near exterior edge, 0 deep inside crust
                rim1 = max(0.0, (a - e1px[x, y]) / 255.0)
                rim2 = max(0.0, (a - e2px[x, y]) / 255.0)

                # Deterministic subtle baked biscuit crumb/pore texture
                n1 = math.sin(x * 0.55 + y * 0.37) * math.cos(x * 0.29 - y * 0.61)
                n2 = math.sin(x * 1.13 - y * 0.91) * 0.5
                grain = (n1 + n2) * 7.5

                # Warm directional lighting (upper-left bright honey, lower-right toasted golden caramel)
                diag = tx * 0.38 + ty * 0.62
                # Golden baked butter-cookie palette (#f5bd6c -> #dd8f38 -> #b8621b)
                r = 247 - 28 * diag - 36 * rim1 - 12 * rim2 + grain
                g = 188 - 44 * diag - 46 * rim1 - 16 * rim2 + grain * 0.85
                b = 104 - 44 * diag - 38 * rim1 - 12 * rim2 + grain * 0.55

                # Crisp warm caramel outer outline on the outermost 2px so overlapping cookies separate cleanly!
                if rim1 > 0.45:
                    t_out = (rim1 - 0.45) / 0.55
                    r -= 28 * t_out
                    g -= 32 * t_out
                    b -= 22 * t_out
                # Subtle bright golden highlight on upper-left biscuit ridge
                elif diag < 0.48:
                    r += 10 * (0.48 - diag)
                    g += 10 * (0.48 - diag)
                    b += 8 * (0.48 - diag)

                opx[x, y] = (clamp(r), clamp(g), clamp(b), a)

        out = bleed_transparent_rgb(out, passes=3)
        out.save(path)
        f_cnt += 1

    # 3B. Bake 60 inner fill sprites -> thick puffy glossy royal sugar icing!
    b_cnt = 0
    for name in sorted(fill_names - frame_names):
        path = os.path.join(BOARDS_DIR, f"{name}.png")
        if not os.path.exists(path):
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        alpha = im.getchannel("A")

        # Multi-scale distance field approximation for plump 3D poured sugar glaze bevel!
        d_sm = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(3))
        d_md = alpha.filter(ImageFilter.MinFilter(13)).filter(ImageFilter.GaussianBlur(7))
        d_lg = alpha.filter(ImageFilter.MinFilter(25)).filter(ImageFilter.GaussianBlur(12))

        apx = alpha.load()
        sm_px = d_sm.load()
        md_px = d_md.load()
        lg_px = d_lg.load()

        # Build shifted specular highlight ridge (light from top-left)
        # Interior offset shadow/highlight by sampling d_md at (x-4, y-5) vs (x+4, y+5)
        out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
        opx = out.load()

        for y in range(h):
            ty = y / max(1, h - 1)
            ym = max(0, y - 5)
            yp = min(h - 1, y + 5)
            for x in range(w):
                a = apx[x, y]
                if a < 18:
                    opx[x, y] = (255, 255, 255, 0)
                    continue
                tx = x / max(1, w - 1)
                xm = max(0, x - 4)
                xp = min(w - 1, x + 4)

                # Smooth bevel gradient (normal approximation from distance field)
                gx = (md_px[xp, y] - md_px[xm, y]) / 255.0
                gy = (md_px[x, yp] - md_px[x, ym]) / 255.0
                # Light vector from upper-left (-0.6, -0.8) -> positive dot when slope faces top-left!
                ndotl = max(-1.0, min(1.0, gx * 0.65 + gy * 0.85))

                # Distance from edge (0 at edge, 1 deep inside)
                depth = (sm_px[x, y] * 0.35 + md_px[x, y] * 0.40 + lg_px[x, y] * 0.25) / 255.0
                edge_rim = max(0.0, (a - sm_px[x, y]) / 255.0)

                # Base creamy dome brightness (bright neutral so pastel tint stays vivid!)
                diag = tx * 0.35 + ty * 0.65
                v = 248 - 18 * diag + 12 * depth

                # Puffy royal-icing bevel lighting
                if ndotl > 0.05:
                    # Juicy curved glossy specular highlight along top-left icing curve!
                    spec = (ndotl ** 1.45) * 42.0
                    v += spec
                else:
                    # Soft plump underside curve shading along lower-right icing edge
                    v += ndotl * 28.0

                # Subtle warm shading right where icing meets the cookie crust
                v -= 16 * edge_rim

                vi = clamp(v, 206, 255)
                # Slightly cooler-pure white on specular peak, super slightly warm on shadow
                if vi >= 252:
                    opx[x, y] = (255, 255, 255, a)
                else:
                    opx[x, y] = (vi, clamp(vi - 1), clamp(vi - 2), a)

        out = bleed_transparent_rgb(out, passes=3)
        out.save(path)
        b_cnt += 1

    print(f"   Baked {f_cnt} golden biscuit frames + {b_cnt} puffy glossy icing fills.")


def make_backgrounds_and_cake_stand():
    print("4) Building dreamy strawberry-pink patisserie backgrounds & scalloped cake-stand deck...")
    src = Image.open(SRC_BG_CANDY).convert("RGB")
    menu_bg = src.resize((750, 1334), Image.Resampling.LANCZOS)
    menu_bg.save(os.path.join(DESSERT_DIR, "bg_dessert_menu.jpg"), quality=95)
    menu_bg.save(os.path.join(UI_ORIG_DIR, "bg_menu_hex.png"))

    # Playfield background: slightly zoomed clean pastel-pink core so cookies pop with crisp clarity
    sw, sh = src.size
    crop = src.crop((int(sw * 0.06), int(sh * 0.08), int(sw * 0.94), int(sh * 0.92)))
    game_bg = crop.resize((750, 1334), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
    # Subtle soft rosy-cream radial center glow
    glow = Image.new("RGBA", (750, 1334), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([40, 380, 710, 1140], fill=(255, 248, 250, 72))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    game_bg = Image.alpha_composite(game_bg.convert("RGBA"), glow).convert("RGB")
    game_bg.save(os.path.join(DESSERT_DIR, "bg_dessert_game.jpg"), quality=95)
    game_bg.save(os.path.join(UI_ORIG_DIR, "bg_game_poly.jpg"), quality=95)

    # 3D Frosted Strawberry-Pink Scalloped Cake-Stand Header Deck (dessert_frame.png & frame.png)
    W, H = 750, 420
    S = 2
    deck = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))

    # Build scalloped bottom silhouette mask at 2x supersampling
    scallop_y = 376 * S
    scallop_r = 24 * S
    num_scallops = 16
    step_x = (W * S) / num_scallops

    # 1) Soft warm rose drop shadow underneath scallops
    sh = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    shd = ImageDraw.Draw(sh)
    shd.rectangle([0, 0, W * S, scallop_y + 10 * S], fill=(186, 82, 122, 85))
    for i in range(num_scallops + 1):
        cx = int(i * step_x)
        shd.ellipse([cx - scallop_r, scallop_y - scallop_r + 12 * S, cx + scallop_r, scallop_y + scallop_r + 12 * S],
                    fill=(186, 82, 122, 85))
    sh = sh.filter(ImageFilter.GaussianBlur(10 * S))
    deck.alpha_composite(sh)

    # 2) Extruded glossy strawberry-pink lower pastry-stand lip
    lip = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lip)
    ld.rectangle([0, 0, W * S, scallop_y + 5 * S], fill=(244, 143, 177, 255))
    for i in range(num_scallops + 1):
        cx = int(i * step_x)
        ld.ellipse([cx - scallop_r, scallop_y - scallop_r + 6 * S, cx + scallop_r, scallop_y + scallop_r + 6 * S],
                   fill=(244, 143, 177, 255))
    deck.alpha_composite(lip)

    # 3) Main frosted pastel-pink-to-cream upper stand surface
    body_mask = Image.new("L", (W * S, H * S), 0)
    bmd = ImageDraw.Draw(body_mask)
    bmd.rectangle([0, 0, W * S, scallop_y], fill=255)
    for i in range(num_scallops + 1):
        cx = int(i * step_x)
        bmd.ellipse([cx - scallop_r + 2 * S, scallop_y - scallop_r, cx + scallop_r - 2 * S, scallop_y + scallop_r - 2 * S],
                    fill=255)

    grad = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(H * S):
        t = y / max(1, H * S - 1)
        r = clamp(255)
        g = clamp(244 - 24 * t)
        b = clamp(248 - 18 * t)
        gd.line([(0, y), (W * S, y)], fill=(r, g, b, 252))
    deck.paste(grad, (0, 0), body_mask)

    # 4) Glossy cream piping highlights on each scallop lobe!
    hi = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    # Soft glossy sheen band across the pastry stand
    hd.rectangle([0, 326 * S, W * S, 368 * S], fill=(255, 255, 255, 72))
    for i in range(num_scallops + 1):
        cx = int(i * step_x)
        hd.ellipse([cx - 12 * S, scallop_y + 2 * S, cx + 12 * S, scallop_y + 14 * S], fill=(255, 255, 255, 130))
    deck.alpha_composite(hi)

    deck_out = deck.resize((W, H), Image.Resampling.LANCZOS)
    deck_out.save(os.path.join(DESSERT_DIR, "dessert_frame.png"))
    deck_out.save(os.path.join(GAMES_DIR, "frame.png"))


def make_sweet_candy_logo():
    """
    4x-supersampled 3D glossy golden-yellow candy bubble logo with hot-pink extruded outline,
    golden candy burst rays, sparkles, and curved hot-pink satin ribbon banner ("SWEET CANDY JAM").
    """
    print("5) Crafting 4x-supersampled Sweet Candy 3D Logo...")
    W, H = 980, 360
    S = 2
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    font_path = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
    f_main = ImageFont.truetype(font_path, 114 * S)
    f_sub = ImageFont.truetype(font_path, 38 * S)

    title = "SCREW OUT"
    tb = d.textbbox((0, 0), title, font=f_main)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    tx = (W * S - tw) // 2 - tb[0]
    ty = 40 * S - tb[1]

    # 1) Soft warm magenta ambient shadow behind title
    sh = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((tx, ty + 18 * S), title, font=f_main,
                            fill=(157, 23, 77, 135), stroke_width=24 * S, stroke_fill=(157, 23, 77, 135))
    sh = sh.filter(ImageFilter.GaussianBlur(7 * S))
    im.alpha_composite(sh)

    # 2) Deep 3D extruded berry-magenta candy shell
    for dy in range(15 * S, 0, -2):
        ratio = dy / (15.0 * S)
        c = (clamp(178 - 32 * ratio), clamp(18 + 8 * ratio), clamp(94 - 16 * ratio), 255)
        d.text((tx, ty + dy), title, font=f_main, fill=c, stroke_width=20 * S, stroke_fill=c)

    # 3) Bright hot-pink candy outline rim + thin cream-pink inner contour
    d.text((tx, ty), title, font=f_main, fill=(236, 36, 122, 255), stroke_width=18 * S, stroke_fill=(236, 36, 122, 255))
    d.text((tx, ty), title, font=f_main, fill=(255, 165, 205, 255), stroke_width=8 * S, stroke_fill=(255, 165, 205, 255))

    # 4) Plump glossy golden-yellow to tangerine-orange gradient fill inside letters
    tmask = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(tmask).text((tx, ty), title, font=f_main, fill=255)

    grad = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    y_top = ty + tb[1]
    for y in range(H * S):
        u = max(0.0, min(1.0, (y - y_top) / max(1, th)))
        # Buttercup sunny yellow -> golden honey -> juicy orange bottom
        r = 255
        g = clamp(248 - 108 * (u ** 1.15))
        b = clamp(106 - 98 * (u ** 0.9))
        gd.line([(0, y), (W * S, y)], fill=(r, g, b, 255))
    im.paste(grad, (0, 0), tmask)

    # 5) Glossy curved top jelly highlight inside letters
    # Erode mask slightly so specular stays tucked neatly inside each letter
    inner_m = tmask.filter(ImageFilter.MinFilter(7))
    spec = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spec)
    sd.rectangle([0, y_top, W * S, y_top + int(th * 0.44)], fill=(255, 255, 240, 128))
    spec = ImageChops.composite(spec, Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)), inner_m)
    im.alpha_composite(spec)

    # 6) Playful candy burst rays flanking cleanly outside S and T!
    burst = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(burst)
    rays = [
        ((32, 58), (74, 86)), ((18, 114), (66, 120)), ((36, 170), (76, 148)),
        ((W - 32, 58), (W - 74, 86)), ((W - 18, 114), (W - 66, 120)), ((W - 36, 170), (W - 76, 148)),
    ]
    for (p0, p1) in rays:
        q0, q1 = (p0[0] * S, p0[1] * S), (p1[0] * S, p1[1] * S)
        bd.line([q0, q1], fill=(225, 29, 116, 235), width=14 * S)
        bd.line([q0, q1], fill=(255, 206, 48, 255), width=9 * S)
        for q in (q0, q1):
            bd.ellipse([q[0] - 4 * S, q[1] - 4 * S, q[0] + 4 * S, q[1] + 4 * S], fill=(255, 224, 96, 255))
    im.alpha_composite(burst)

    # 7) Glossy Hot-Pink Satin Ribbon Banner ("SWEET CANDY JAM") with cute hearts on ends!
    rib_y0, rib_y1 = 224 * S, 304 * S
    rib_x0, rib_x1 = 192 * S, (W - 192) * S
    # Shadow under ribbon
    rsh = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ImageDraw.Draw(rsh).rounded_rectangle([rib_x0, rib_y0 + 10 * S, rib_x1, rib_y1 + 10 * S], radius=40 * S, fill=(157, 23, 77, 115))
    rsh = rsh.filter(ImageFilter.GaussianBlur(6 * S))
    im.alpha_composite(rsh)

    # Ribbon bottom 3D lip
    d.rounded_rectangle([rib_x0, rib_y0 + 6 * S, rib_x1, rib_y1 + 6 * S], radius=40 * S, fill=(190, 24, 93, 255))
    # Ribbon main glossy gradient
    rgrad = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    rgd = ImageDraw.Draw(rgrad)
    for y in range(rib_y0, rib_y1):
        t = (y - rib_y0) / max(1, rib_y1 - rib_y0)
        rgd.line([(rib_x0, y), (rib_x1, y)], fill=(clamp(252 - 22 * t), clamp(88 - 44 * t), clamp(156 - 36 * t), 255))
    rmask = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(rmask).rounded_rectangle([rib_x0, rib_y0, rib_x1, rib_y1], radius=40 * S, fill=255)
    im.paste(rgrad, (0, 0), rmask)
    # Glossy top highlight bar on ribbon
    rhi = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ImageDraw.Draw(rhi).rounded_rectangle([rib_x0 + 22 * S, rib_y0 + 7 * S, rib_x1 - 22 * S, rib_y0 + 30 * S], radius=12 * S, fill=(255, 255, 255, 92))
    im.alpha_composite(rhi)
    # Crisp light-pink border on ribbon
    d.rounded_rectangle([rib_x0, rib_y0, rib_x1, rib_y1], radius=40 * S, outline=(255, 206, 226, 245), width=4 * S)

    # Cute cream-pink hearts on both ends of ribbon
    h_ico = draw_heart_cookie_charm(40 * S)
    im.alpha_composite(h_ico, (rib_x0 + 16 * S, (rib_y0 + rib_y1) // 2 - 20 * S))
    im.alpha_composite(h_ico, (rib_x1 - 56 * S, (rib_y0 + rib_y1) // 2 - 20 * S))

    sub_txt = "SWEET CANDY JAM"
    sb = d.textbbox((0, 0), sub_txt, font=f_sub)
    sw, sh_t = sb[2] - sb[0], sb[3] - sb[1]
    sx = (W * S - sw) // 2 - sb[0]
    sy = (rib_y0 + rib_y1) // 2 - sh_t // 2 - sb[1] - 2 * S
    d.text((sx, sy + 3 * S), sub_txt, font=f_sub, fill=(148, 18, 72, 220))
    d.text((sx, sy), sub_txt, font=f_sub, fill=(255, 252, 245, 255))

    # Crisp 4-point sparkles
    for (px_s, py_s, rad) in [(112, 46, 22), (792, 52, 24), (748, 212, 18), (146, 216, 16)]:
        cx_s, cy_s, r_s = px_s * S, py_s * S, rad * S
        pts = [
            (cx_s, cy_s - r_s), (cx_s + r_s * 0.28, cy_s - r_s * 0.28),
            (cx_s + r_s, cy_s), (cx_s + r_s * 0.28, cy_s + r_s * 0.28),
            (cx_s, cy_s + r_s), (cx_s - r_s * 0.28, cy_s + r_s * 0.28),
            (cx_s - r_s, cy_s), (cx_s - r_s * 0.28, cy_s - r_s * 0.28),
        ]
        d.polygon(pts, fill=(255, 252, 220, 245))

    out = im.resize((W, H), Image.Resampling.LANCZOS)
    out.save(os.path.join(DESSERT_DIR, "logo_sweet_jam.png"))
    out.save(os.path.join(UI_ORIG_DIR, "logo_screw_jam.png"))


def make_candy_ui_and_skills():
    print("6) Upgrading ALL Skill Icons, Buttons, Popups, Bakery Box & Frame to Sweet Candy style...")

    # Helper: glossy 3D pill / rounded button
    def make_candy_pill(w, h, top_rgb, bot_rgb, lip_rgb, rim_rgb=(255, 255, 255), radius=None):
        S = 2
        W, H = w * S, h * S
        rad = (radius * S) if radius is not None else (H // 2 - 6 * S)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # Soft drop shadow
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([6 * S, 12 * S, W - 6 * S, H - 2 * S], radius=rad, fill=(157, 23, 77, 65))
        sh = sh.filter(ImageFilter.GaussianBlur(4 * S))
        im.alpha_composite(sh)
        d = ImageDraw.Draw(im)
        # 3D extruded bottom lip
        d.rounded_rectangle([6 * S, 10 * S, W - 6 * S, H - 6 * S], radius=rad, fill=(*lip_rgb, 255))
        # Glossy gradient body
        grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        y0, y1 = 4 * S, H - 14 * S
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            c = tuple(clamp(top_rgb[k] * (1 - t) + bot_rgb[k] * t) for k in range(3))
            gd.line([(0, y), (W, y)], fill=(*c, 255))
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).rounded_rectangle([6 * S, y0, W - 6 * S, y1], radius=rad, fill=255)
        im.paste(grad, (0, 0), mask)
        # Glossy top crescent highlight
        sp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sp).rounded_rectangle([18 * S, y0 + 5 * S, W - 18 * S, y0 + int((y1 - y0) * 0.44)], radius=rad // 2, fill=(255, 255, 255, 96))
        im.alpha_composite(sp)
        # Crisp icing rim outline
        d.rounded_rectangle([6 * S, y0, W - 6 * S, y1], radius=rad, outline=(*rim_rgb, 240), width=4 * S)
        return im.resize((w, h), Image.Resampling.LANCZOS)

    # 6A. Candy Skill Card Base (skill_btn_bg.png, 224x216) — Frosted Strawberry-Cream Cookie Tile!
    W, H = 224, 216
    S = 2
    sbtn = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([10 * S, 18 * S, (W - 10) * S, (H - 4) * S], radius=34 * S, fill=(168, 56, 102, 72))
    sh = sh.filter(ImageFilter.GaussianBlur(6 * S))
    sbtn.alpha_composite(sh)

    sd = ImageDraw.Draw(sbtn)
    # Warm baked caramel-rose 3D extruded bottom lip
    sd.rounded_rectangle([8 * S, 14 * S, (W - 8) * S, (H - 8) * S], radius=34 * S, fill=(224, 134, 166, 255))
    # Creamy vanilla-to-blush frosted body
    sbody = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    sbd = ImageDraw.Draw(sbody)
    for y in range(6 * S, (H - 16) * S):
        t = (y - 6 * S) / max(1, (H - 22) * S)
        r = 255
        g = clamp(252 - 18 * t)
        b = clamp(246 - 8 * t)
        sbd.line([(0, y), (W * S, y)], fill=(r, g, b, 255))
    smask = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(smask).rounded_rectangle([8 * S, 6 * S, (W - 8) * S, (H - 16) * S], radius=34 * S, fill=255)
    sbtn.paste(sbody, (0, 0), smask)

    # Soft strawberry-cream recessed cradle behind icon
    sd.rounded_rectangle([20 * S, 18 * S, (W - 20) * S, 136 * S], radius=24 * S, fill=(255, 228, 238, 195))
    # Glossy hot-pink berry nameplate ribbon at bottom for crisp white skill label!
    sd.rounded_rectangle([20 * S, 140 * S, (W - 20) * S, 188 * S], radius=22 * S, fill=(236, 64, 134, 255))
    sd.rounded_rectangle([26 * S, 143 * S, (W - 26) * S, 162 * S], radius=12 * S, fill=(255, 164, 204, 130))
    # Crisp royal-icing white outer border
    sd.rounded_rectangle([8 * S, 6 * S, (W - 8) * S, (H - 16) * S], radius=34 * S, outline=(255, 255, 255, 250), width=4 * S)
    sbtn.resize((W, H), Image.Resampling.LANCZOS).save(os.path.join(UI_ORIG_DIR, "skill_btn_bg.png"))

    # 6B. Skill Icon 1 (+1 SLOT -> icon_skill_slot.png): Golden Frosted Cookie Tray Socket + Pink/Gold '+' Candy Badge!
    slot_base = draw_cookie_socket_hole(112, style="tray")
    slot_ico = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    slot_ico.alpha_composite(slot_base, (4, 4))
    # Glossy hot-pink candy '+' badge in bottom-right
    plus_b = make_candy_pill(48, 48, (255, 110, 174), (225, 29, 116), (170, 18, 86), radius=22)
    pd = ImageDraw.Draw(plus_b)
    pd.rectangle([21, 13, 27, 33], fill=(255, 255, 255, 255))
    pd.rectangle([14, 20, 34, 26], fill=(255, 255, 255, 255))
    slot_ico.alpha_composite(plus_b, (76, 74))
    slot_ico.save(os.path.join(UI_ORIG_DIR, "icon_skill_slot.png"))

    # 6C. Skill Icon 2 (CLEAR -> UI_icon3.png): Candy-graded 3D Pastry Whisk/Broom with strawberry-pink satin band!
    broom_path = os.path.join(UI_ORIG_DIR, "UI_icon3.png")
    if os.path.exists(broom_path):
        im = Image.open(broom_path).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                if 0.45 <= hh <= 0.68 and ss > 0.25:
                    # Blue ring -> glossy hot-pink satin candy ribbon!
                    nr, ng, nb = colorsys.hsv_to_rgb(0.925, min(1.0, ss * 1.05), min(1.0, vv * 1.04))
                    px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
                elif 0.04 <= hh <= 0.16 and ss > 0.25:
                    # Warmer golden-vanilla buttercream glow on bristles/handle
                    nr, ng, nb = colorsys.hsv_to_rgb(hh, min(1.0, ss * 0.94), min(1.0, vv * 1.08 + 0.03))
                    px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
        # Add two cute golden sparkles
        bd = ImageDraw.Draw(im)
        for (sx, sy, sr) in [(26, 26, 11), (104, 96, 9)]:
            pts = [(sx, sy - sr), (sx + sr * 0.28, sy - sr * 0.28), (sx + sr, sy), (sx + sr * 0.28, sy + sr * 0.28),
                   (sx, sy + sr), (sx - sr * 0.28, sy + sr * 0.28), (sx - sr, sy), (sx - sr * 0.28, sy - sr * 0.28)]
            bd.polygon(pts, fill=(255, 240, 120, 245))
        im.save(broom_path)

    # 6D. Skill Icon 3 (MELT -> UI_icon2.png): Candy-graded 3D Sparkling Strawberry-Rose Magic Frosting Bottle!
    pot_path = os.path.join(UI_ORIG_DIR, "UI_icon2.png")
    if os.path.exists(pot_path):
        im = Image.open(pot_path).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                if 0.22 <= hh <= 0.48 and ss > 0.22:
                    # Green potion -> glowing strawberry-rose pink berry syrup!
                    nr, ng, nb = colorsys.hsv_to_rgb(0.935, min(1.0, ss * 0.92), min(1.0, vv * 1.12 + 0.04))
                    px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
        im.save(pot_path)

    # 6E. Candy Count & AD Badges
    make_candy_pill(76, 76, (94, 234, 180), (16, 185, 129), (5, 140, 96), radius=34).save(os.path.join(UI_ORIG_DIR, "badge_count.png"))
    make_candy_pill(96, 70, (255, 212, 64), (245, 130, 18), (196, 86, 8), radius=30).save(os.path.join(UI_ORIG_DIR, "badge_ad.png"))

    # 6F. Glossy Strawberry-Pink Pause Button (btn_pause.png, 82x82)
    pause = make_candy_pill(82, 82, (255, 118, 178), (232, 46, 126), (178, 24, 92), radius=38)
    pd = ImageDraw.Draw(pause)
    pd.rounded_rectangle([26, 23, 37, 55], radius=5, fill=(255, 252, 248, 255))
    pd.rounded_rectangle([45, 23, 56, 55], radius=5, fill=(255, 252, 248, 255))
    pause.save(os.path.join(UI_ORIG_DIR, "btn_pause.png"))

    # 6G. Glossy Cherry-Berry Close Button (btn_close.png, 68x68)
    close_b = make_candy_pill(68, 68, (255, 102, 142), (225, 29, 72), (168, 16, 52), radius=31)
    cd = ImageDraw.Draw(close_b)
    cd.line([(23, 22), (45, 44)], fill=(255, 252, 248, 255), width=7)
    cd.line([(45, 22), (23, 44)], fill=(255, 252, 248, 255), width=7)
    close_b.save(os.path.join(UI_ORIG_DIR, "btn_close.png"))

    # 6H. Glossy Strawberry-Pink Settings Button (UI_icon_setting.png, 94x94)
    set_b = make_candy_pill(94, 94, (255, 118, 178), (232, 46, 126), (178, 24, 92), radius=44)
    sd_g = ImageDraw.Draw(set_b)
    cx, cy = 47, 44
    for i in range(8):
        ang = i * math.pi / 4.0
        px_g = cx + math.cos(ang) * 18
        py_g = cy + math.sin(ang) * 18
        sd_g.ellipse([px_g - 7, py_g - 7, px_g + 7, py_g + 7], fill=(255, 252, 248, 255))
    sd_g.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(255, 252, 248, 255))
    sd_g.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(232, 46, 126, 255))
    set_b.save(os.path.join(UI_ORIG_DIR, "UI_icon_setting.png"))

    # 6I. Glossy Berry-Pink Level Pill (level_pill.png, 260x62 — generous height so LEVEL N sits crisply inside!)
    make_candy_pill(260, 62, (248, 86, 156), (206, 28, 108), (150, 16, 76), radius=26).save(os.path.join(UI_ORIG_DIR, "level_pill.png"))

    # 6J. Juicy Golden-Honey Candy PLAY Button (btn_play.png, 420x128) — matches yellow candy logo!
    make_candy_pill(420, 128, (255, 214, 52), (255, 134, 16), (204, 72, 44), rim_rgb=(255, 250, 232), radius=56).save(
        os.path.join(UI_ORIG_DIR, "btn_play.png")
    )

    # 6K. Gallery Button (icon_menu_gallery.png, 160x148) — Lavender-Berry Candy Squircle + 4 Mini Gummy Screws!
    gal = make_candy_pill(160, 148, (216, 132, 255), (158, 66, 236), (112, 38, 178), radius=34)
    for (sx, sy, cid) in [(44, 22, 1), (82, 22, 2), (44, 60, 8), (82, 60, 7)]:
        sp = os.path.join(DESSERT_DIR, f"dessert_screw{cid}.png")
        if os.path.exists(sp):
            ms = Image.open(sp).convert("RGBA").resize((34, 34), Image.Resampling.LANCZOS)
            gal.alpha_composite(ms, (sx, sy))
    gal.save(os.path.join(UI_ORIG_DIR, "icon_menu_gallery.png"))

    # 6L. Frosted Strawberry-Cream Popup Card (UI_db2.png, 520x580) — replaces cyan border!
    W, H = 520, 580
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    # Soft warm berry 3D bottom lip
    cd.rounded_rectangle([4, 12, W - 4, H - 2], radius=44, fill=(219, 86, 142, 255))
    # Thick glossy strawberry-pink frosting border
    cd.rounded_rectangle([4, 4, W - 4, H - 10], radius=44, fill=(244, 114, 168, 255), outline=(255, 214, 232, 255), width=4)
    # Warm vanilla-cream inner panel
    cd.rounded_rectangle([16, 16, W - 16, H - 22], radius=34, fill=(255, 250, 246, 255))
    card.save(os.path.join(UI_ORIG_DIR, "UI_db2.png"))

    # 6M. Progress Bar Track & Fill (UI_jdt_1.png, UI_jdt_2.png, 500x42)
    track = Image.new("RGBA", (500, 42), (0, 0, 0, 0))
    td = ImageDraw.Draw(track)
    td.rounded_rectangle([2, 2, 498, 40], radius=19, fill=(142, 58, 92, 240), outline=(255, 216, 232, 255), width=3)
    track.save(os.path.join(UI_ORIG_DIR, "UI_jdt_1.png"))

    fill_b = make_candy_pill(500, 42, (255, 218, 72), (255, 136, 46), (224, 92, 34), rim_rgb=(255, 244, 210), radius=18)
    fill_b.save(os.path.join(UI_ORIG_DIR, "UI_jdt_2.png"))

    # 6N. Bakery Pastry Gift Box (xzx.png & xzx_front.png) — grade brown crate to strawberry-pink bakery box!
    for fname in ("xzx.png", "xzx_front.png"):
        fpath = os.path.join(UI_ORIG_DIR, fname)
        if not os.path.exists(fpath):
            continue
        im = Image.open(fpath).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                # Shift warm cardboard tan/orange -> cute pastel strawberry-pink bakery box!
                nr, ng, nb = colorsys.hsv_to_rgb(0.945, min(0.68, ss * 0.72), min(1.0, (vv ** 0.88) * 1.08 + 0.04))
                px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
        im.save(fpath)

    # 6O. Warm Caramel-Waffle Pastry Frame (wood_frame.png) — warm golden sugar-cookie glaze tone!
    wf_path = os.path.join(UI_ORIG_DIR, "wood_frame.png")
    if os.path.exists(wf_path):
        im = Image.open(wf_path).convert("RGBA")
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                # Soften dark wood into lighter golden butter-waffle biscuit & rose-gold cream warmth
                if ss > 0.16:
                    nr, ng, nb = colorsys.hsv_to_rgb(0.088, min(0.62, ss * 0.76), min(1.0, (vv ** 0.84) * 1.12 + 0.05))
                    px[x, y] = (clamp(nr * 255), clamp(ng * 255), clamp(nb * 255), a)
        im.save(wf_path)


def main():
    make_gummy_screws_and_shaft()
    make_macaron_boxes_and_lids()
    bake_frosted_cookie_boards()
    make_backgrounds_and_cake_stand()
    make_sweet_candy_logo()
    make_candy_ui_and_skills()
    print("ALL Sweet Candy & Frosted Cookie assets built successfully!")


if __name__ == "__main__":
    main()
