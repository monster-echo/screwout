#!/usr/bin/env python3
"""
Generates complete Apple App Store & Google Play promotional asset kit for
Screw Out: Sweet Jam:
  - App Store Icon: 1024x1024 RGB (no alpha)
  - Google Play Icon: 512x512 RGBA + Android Adaptive Icon fg/bg (432x432)
  - Google Play Feature Graphic: 1024x500
  - High-Res Transparent Candy Title Logo: Logo_ScrewOut_SweetJam.png
  - 5 Promotional Screenshots for iOS 6.7" (1290x2796) & Google Play (1080x1920)
    framed around real live in-game captures from store_assets/raw_captures/
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "/Users/echo/workspace/CocosGames/ScrewOut"
STORE_DIR = os.path.join(ROOT, "store_assets")
IOS_DIR = os.path.join(STORE_DIR, "ios")
IOS_SHOTS = os.path.join(IOS_DIR, "screenshots_6.7")
AND_DIR = os.path.join(STORE_DIR, "android")
AND_SHOTS = os.path.join(AND_DIR, "screenshots_phone")
RAW_DIR = os.path.join(STORE_DIR, "raw_captures")
DESSERT_DIR = os.path.join(ROOT, "assets/resources/sprites/themes/dessert")

for d in (IOS_DIR, IOS_SHOTS, AND_DIR, AND_SHOTS):
    os.makedirs(d, exist_ok=True)

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
if not os.path.exists(FONT_BOLD):
    FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def load_font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def draw_outlined_text(draw: ImageDraw.ImageDraw, pos, text: str, font, fill, stroke_fill, stroke_width: int,
                       shadow_offset=(0, 6), shadow_fill=(40, 15, 35, 110), anchor="mm"):
    x, y = pos
    if shadow_offset:
        draw.text((x + shadow_offset[0], y + shadow_offset[1]), text, font=font,
                  fill=shadow_fill, stroke_width=stroke_width, stroke_fill=shadow_fill, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill, anchor=anchor)


def make_gradient(size, top_rgb, bot_rgb) -> Image.Image:
    w, h = size
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top_rgb[0] + (bot_rgb[0] - top_rgb[0]) * t)
        g = int(top_rgb[1] + (bot_rgb[1] - top_rgb[1]) * t)
        b = int(top_rgb[2] + (bot_rgb[2] - top_rgb[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return im


def draw_frosted_cookie_shape(size, icing_rgb, biscuit_rgb=(255, 253, 250), radius=52, rot=0.0) -> Image.Image:
    w, h = size
    pad = 80
    im = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Soft studio drop shadow
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad + 8, pad + 20, pad + w + 8, pad + h + 20], radius=radius, fill=(90, 56, 78, 80))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    im.alpha_composite(sh)
    # Crisp snow-white royal-icing 3D outer rim (matches upgraded in-game glazed boards!)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=biscuit_rgb + (255,),
                        outline=(232, 224, 236, 255), width=4)
    # Glossy macaron glaze body
    m = 16
    d.rounded_rectangle([pad + m, pad + m, pad + w - m, pad + h - m], radius=max(16, radius - 12),
                        fill=icing_rgb + (255,), outline=(255, 255, 255, 195), width=4)
    # Glossy top highlight sheen
    d.rounded_rectangle([pad + m + 16, pad + m + 10, pad + w - m - 16, pad + m + 46], radius=16,
                        fill=(255, 255, 255, 95))
    if rot != 0.0:
        im = im.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
    return im


def build_app_icons():
    """
    Creates 1024x1024 iOS App Store Icon (RGB, no alpha), 512x512 Google Play Icon,
    and Android Adaptive Icon fg/bg layers.
    """
    S = 1024
    # Vibrant warm sky-to-strawberry-cream radial-feel background
    bg = make_gradient((S, S), (108, 206, 255), (255, 174, 210)).convert("RGBA")
    # Luminous center sunburst glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([90, 90, S - 90, S - 90], fill=(255, 250, 232, 165))
    glow = glow.filter(ImageFilter.GaussianBlur(95))
    bg.alpha_composite(glow)

    # Save Adaptive Icon Background (432x432)
    bg.convert("RGB").resize((432, 432), Image.Resampling.LANCZOS).save(os.path.join(AND_DIR, "AdaptiveIcon_bg_432.png"))

    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Overlapping frosted cookies (Mint bottom-left, Lemon top-right, Strawberry center)
    c_mint = draw_frosted_cookie_shape((480, 310), (146, 238, 198), radius=64, rot=-18)
    c_lemon = draw_frosted_cookie_shape((480, 310), (255, 226, 132), radius=64, rot=22)
    c_pink = draw_frosted_cookie_shape((520, 340), (255, 162, 202), radius=70, rot=-6)

    fg.alpha_composite(c_mint, (60, 420))
    fg.alpha_composite(c_lemon, (310, 120))
    fg.alpha_composite(c_pink, (160, 285))

    # Load our 3D gummy screws & scale up cleanly
    def paste_screw(color_id: int, cx: int, cy: int, sz: int, shadow=True):
        s_path = os.path.join(DESSERT_DIR, f"dessert_screw{color_id}.png")
        s_im = Image.open(s_path).convert("RGBA").resize((sz, sz), Image.Resampling.LANCZOS)
        if shadow:
            sh = Image.new("RGBA", (sz + 40, sz + 40), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse([18, 24, sz + 22, sz + 28], fill=(80, 28, 36, 115))
            sh = sh.filter(ImageFilter.GaussianBlur(10))
            fg.alpha_composite(sh, (cx - sz // 2 - 20, cy - sz // 2 - 14))
        fg.alpha_composite(s_im, (cx - sz // 2, cy - sz // 2))

    # Background pinned screws
    paste_screw(4, 290, 610, 175)  # Blueberry
    paste_screw(3, 735, 340, 175)  # Green Apple
    paste_screw(2, 710, 645, 170)  # Lemon

    # Hero popping Strawberry Ruby Gummy Screw in center with golden swirl sparkle!
    d = ImageDraw.Draw(fg)
    d.arc([230, 190, 720, 680], start=200, end=340, fill=(255, 246, 170, 235), width=18)
    d.arc([260, 220, 690, 650], start=215, end=325, fill=(255, 255, 255, 220), width=9)

    paste_screw(1, 470, 430, 320)  # Giant Hero Strawberry Screw

    # Sparkles & sugar sprinkles
    rng = random.Random(77)
    sp_cols = [(255, 255, 255, 245), (255, 238, 128, 245), (255, 148, 196, 240), (132, 236, 206, 240)]
    for _ in range(18):
        sx, sy = rng.randint(120, 900), rng.randint(120, 900)
        if math.hypot(sx - 470, sy - 430) < 180:
            continue
        r = rng.randint(8, 18)
        col = rng.choice(sp_cols)
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=col)

    # Save Adaptive Icon Foreground (432x432)
    fg.resize((432, 432), Image.Resampling.LANCZOS).save(os.path.join(AND_DIR, "AdaptiveIcon_fg_432.png"))

    # Composite final App Icon
    icon_rgba = bg.copy()
    icon_rgba.alpha_composite(fg)
    # iOS App Store requires 1024x1024 RGB with NO alpha channel
    icon_rgba.convert("RGB").save(os.path.join(IOS_DIR, "AppIcon_1024x1024.png"))
    # Google Play requires 512x512
    icon_rgba.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(AND_DIR, "PlayIcon_512x512.png"))
    print("Built AppIcon_1024x1024.png, PlayIcon_512x512.png, and AdaptiveIcon layers.")


def build_title_logo() -> Image.Image:
    """High-res transparent 3D candy-gloss title logo: SCREW OUT: SWEET JAM."""
    W, H = 900, 300
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f_big = load_font(FONT_BLACK, 108)
    f_sub = load_font(FONT_BOLD, 56)

    # Main title: SCREW OUT
    draw_outlined_text(d, (W // 2, 104), "SCREW OUT", f_big,
                       fill=(255, 250, 240, 255), stroke_fill=(196, 36, 98, 255), stroke_width=14,
                       shadow_offset=(0, 12), shadow_fill=(110, 18, 56, 145))

    # Subtitle ribbon pill: SWEET JAM
    d.rounded_rectangle([205, 180, 695, 258], radius=38, fill=(244, 63, 126, 255),
                        outline=(255, 255, 255, 255), width=6)
    draw_outlined_text(d, (W // 2, 220), "SWEET JAM", f_sub,
                       fill=(255, 244, 156, 255), stroke_fill=(146, 24, 68, 255), stroke_width=6,
                       shadow_offset=(0, 4), shadow_fill=(100, 12, 48, 120))

    im.save(os.path.join(STORE_DIR, "Logo_ScrewOut_SweetJam.png"))
    return im


def build_feature_graphic(logo_im: Image.Image):
    """Google Play Feature Graphic (1024x500)."""
    W, H = 1024, 500
    bg = make_gradient((W, H), (138, 214, 255), (255, 198, 222)).convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-80, -80, 640, 560], fill=(255, 252, 236, 170))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    bg.alpha_composite(glow)

    # Right side: appetizing frosted cookie stack + gummy screws + candy pastry box
    c1 = draw_frosted_cookie_shape((280, 185), (146, 238, 198), radius=42, rot=-14)
    c2 = draw_frosted_cookie_shape((280, 185), (255, 226, 132), radius=42, rot=16)
    c3 = draw_frosted_cookie_shape((290, 195), (255, 162, 202), radius=46, rot=-5)
    bg.alpha_composite(c1, (560, 190))
    bg.alpha_composite(c2, (640, 20))
    bg.alpha_composite(c3, (605, 115))

    for cid, cx, cy, sz in [(1, 755, 210, 128), (4, 680, 315, 86), (2, 855, 165, 86), (3, 865, 315, 84)]:
        s = Image.open(os.path.join(DESSERT_DIR, f"dessert_screw{cid}.png")).convert("RGBA").resize((sz, sz), Image.Resampling.LANCZOS)
        bg.alpha_composite(s, (cx - sz // 2, cy - sz // 2))

    box1 = Image.open(os.path.join(DESSERT_DIR, "dessert_box1.png")).convert("RGBA").resize((104, 134), Image.Resampling.LANCZOS)
    box4 = Image.open(os.path.join(DESSERT_DIR, "dessert_box4.png")).convert("RGBA").resize((96, 124), Image.Resampling.LANCZOS)
    bg.alpha_composite(box4.rotate(-12, expand=True), (510, 345))
    bg.alpha_composite(box1.rotate(8, expand=True), (888, 342))

    # Left side: Logo + Tagline
    logo_sm = logo_im.resize((520, 174), Image.Resampling.LANCZOS)
    bg.alpha_composite(logo_sm, (38, 92))

    d = ImageDraw.Draw(bg)
    f_tag = load_font(FONT_BOLD, 25)
    draw_outlined_text(d, (298, 326), "Unscrew Candy • Drop Cookies • Relax!", f_tag,
                       fill=(255, 255, 255, 255), stroke_fill=(180, 42, 96, 255), stroke_width=4,
                       shadow_offset=(0, 3), shadow_fill=(90, 20, 50, 110))

    # Badge pill
    d.rounded_rectangle([118, 378, 478, 436], radius=29, fill=(255, 255, 255, 235))
    f_pill = load_font(FONT_BOLD, 25)
    d.text((298, 407), "100+ Levels  •  Dual Themes", font=f_pill, fill=(219, 39, 119, 255), anchor="mm")

    bg.convert("RGB").save(os.path.join(AND_DIR, "FeatureGraphic_1024x500.png"))
    print("Built FeatureGraphic_1024x500.png")


def build_promo_screenshots():
    """
    Frames real live captures into high-CTR App Store 6.7" (1290x2796)
    and Google Play (1080x1920) promotional screenshots.
    """
    specs = [
        ("01_sweet_jam", "04_gameplay_dessert_lv1.png",
         "UNSCREW SWEET", "CANDY BOLTS!", "Pop juicy gummy screws & match pastry boxes",
         (255, 168, 206), (255, 234, 186)),
        ("02_asmr_cookies", "05_gameplay_dessert_lv5.png",
         "SATISFYING ASMR", "COOKIE DROPS!", "Unpin frosted layers with crunchy physics",
         (134, 214, 255), (255, 202, 224)),
        ("03_dual_themes", "02_theme_shop.png",
         "SWITCH SKINS", "ANYTIME!", "Sweet Dessert, Wood & Acrylic, or Nordic",
         (192, 168, 255), (255, 210, 228)),
        ("04_crystal_clarity", "06_gameplay_acrylic_lv10.png",
         "CRYSTAL CLARITY", "FOR PRO LEVELS!", "Switch to Wood & Acrylic on deep puzzles",
         (94, 198, 255), (176, 244, 224)),
        ("05_pixel_gallery", "03_gallery.png",
         "COLLECT 3D", "PIXEL ARTWORKS!", "Use earned bolts to craft 12 HD masterpieces",
         (255, 198, 134), (255, 168, 204)),
    ]

    targets = [
        (IOS_SHOTS, 1290, 2796, "ios"),
        (AND_SHOTS, 1080, 1920, "android"),
    ]

    for out_dir, W, H, tag in targets:
        for slug, raw_fn, line1, line2, sub, c_top, c_bot in specs:
            raw_path = os.path.join(RAW_DIR, raw_fn)
            if not os.path.exists(raw_path):
                print(f"Skipping missing capture {raw_path}")
                continue

            canvas = make_gradient((W, H), c_top, c_bot).convert("RGBA")
            # Soft studio radial light
            glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(glow).ellipse([int(-W * 0.1), int(H * 0.12), int(W * 1.1), int(H * 0.88)],
                                         fill=(255, 255, 255, 95))
            glow = glow.filter(ImageFilter.GaussianBlur(90))
            canvas.alpha_composite(glow)

            d = ImageDraw.Draw(canvas)
            scale = W / 1080.0
            f_h1 = load_font(FONT_BLACK, int(86 * scale))
            f_h2 = load_font(FONT_BLACK, int(88 * scale))
            f_sub = load_font(FONT_BOLD, int(36 * scale))

            top_y1 = int(H * 0.068)
            top_y2 = int(H * 0.122)
            sub_y = int(H * 0.172)

            draw_outlined_text(d, (W // 2, top_y1), line1, f_h1,
                               fill=(255, 255, 255, 255), stroke_fill=(186, 36, 94, 255), stroke_width=int(10 * scale),
                               shadow_offset=(0, int(8 * scale)), shadow_fill=(80, 18, 48, 125))
            draw_outlined_text(d, (W // 2, top_y2), line2, f_h2,
                               fill=(255, 244, 148, 255), stroke_fill=(186, 36, 94, 255), stroke_width=int(10 * scale),
                               shadow_offset=(0, int(8 * scale)), shadow_fill=(80, 18, 48, 125))
            d.text((W // 2, sub_y), sub, font=f_sub, fill=(72, 24, 52, 230), anchor="mm")

            # Sleek modern phone bezel framing the real live game capture
            shot = Image.open(raw_path).convert("RGBA")
            max_ph_w = int(W * 0.80)
            max_ph_h = int(H * 0.74)
            ratio = min(max_ph_w / shot.width, max_ph_h / shot.height)
            sw, sh = int(shot.width * ratio), int(shot.height * ratio)
            shot_rs = shot.resize((sw, sh), Image.Resampling.LANCZOS)

            bezel = int(20 * scale)
            bw, bh = sw + bezel * 2, sh + bezel * 2
            bx = (W - bw) // 2
            by = int(H * 0.215) + max(0, (max_ph_h - bh) // 2)

            # Phone drop shadow
            psh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(psh).rounded_rectangle([bx + 12, by + 24, bx + bw + 12, by + bh + 24],
                                                  radius=int(64 * scale), fill=(45, 20, 40, 115))
            psh = psh.filter(ImageFilter.GaussianBlur(28))
            canvas.alpha_composite(psh)

            # White/pearl phone chassis + inner rounded mask
            d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(62 * scale),
                                fill=(30, 41, 59, 255), outline=(255, 255, 255, 235), width=int(6 * scale))

            mask = Image.new("L", (sw, sh), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh], radius=int(46 * scale), fill=255)
            canvas.paste(shot_rs, (bx + bezel, by + bezel), mask)

            out_path = os.path.join(out_dir, f"{slug}_{W}x{H}.png")
            canvas.convert("RGB").save(out_path, quality=95)
        print(f"Built 5 promotional screenshots for {tag} ({W}x{H}).")


def main():
    build_app_icons()
    logo = build_title_logo()
    build_feature_graphic(logo)
    build_promo_screenshots()
    print("All App Store & Google Play graphics complete!")


if __name__ == "__main__":
    main()
