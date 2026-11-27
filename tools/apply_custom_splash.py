#!/usr/bin/env python3
"""
Generate & apply Sweet Candy LaunchScreen art, custom Cocos splashScreen settings,
and refreshed Sweet Candy AppIcon so ScrewOut never shows the black 'Created with Cocos' splash.
"""
import base64
import json
import math
import os
import shutil
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DESSERT_DIR = os.path.join(ROOT, "assets", "resources", "sprites", "themes", "dessert")
BOARDS_DIR = os.path.join(ROOT, "assets", "resources", "sprites", "boards")
LAUNCH_SRC_DIR = os.path.join(ROOT, "settings", "launch")
IOS_NATIVE_DIR = os.path.join(ROOT, "native", "engine", "ios")
ICONSET_DIR = os.path.join(IOS_NATIVE_DIR, "Images.xcassets", "AppIcon.appiconset")
STORE_ICON = os.path.join(ROOT, "store_assets", "ios", "AppIcon_1024x1024.png")
LOGO_PATH = os.path.join(ROOT, "settings", "splash_logo.png")

os.makedirs(LAUNCH_SRC_DIR, exist_ok=True)


def compose_sweet_cookie_badge(size: int = 560) -> Image.Image:
    """Composes an appetizing frosted star/heart sugar cookie cluster with glossy gummy screws & sprinkles."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Load our studio-baked pink-frosted heart & cream star cookies + 3D gummy screws
    # Pick a clean heart frame+fill or star-like board sprite, or draw a 4x supersampled frosted cookie star!
    S = size * 2
    hi = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Draw a plump 5-point rounded star sugar cookie (echoing the hero reference art!)
    cx, cy = S // 2, S // 2
    r_outer = S * 0.41
    r_inner = S * 0.25

    def star_poly(ro, ri, pts_n=5, steps_per_seg=18):
        verts = []
        for i in range(pts_n * 2):
            ang = -math.pi / 2 + i * math.pi / pts_n
            r = ro if i % 2 == 0 else ri
            verts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
        # Chaikin smoothing 3 passes for super plump rounded cookie lobes!
        for _ in range(3):
            nv = []
            n = len(verts)
            for i in range(n):
                p0 = verts[i]
                p1 = verts[(i + 1) % n]
                nv.append((p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25))
                nv.append((p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75))
            verts = nv
        return verts

    outer_pts = star_poly(r_outer, r_inner)
    icing_pts = star_poly(r_outer * 0.85, r_inner * 0.84)

    # 1. Soft rose-caramel drop shadow
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(x, y + 26) for (x, y) in outer_pts], fill=(160, 56, 98, 95))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    hi.alpha_composite(sh)

    # 2. Baked golden butter-cookie 3D crust (extruded lower lip + warm golden top)
    d = ImageDraw.Draw(hi)
    d.polygon([(x, y + 16) for (x, y) in outer_pts], fill=(184, 98, 30, 255))
    d.polygon(outer_pts, fill=(238, 162, 72, 255))
    # Subtle toasted edge stroke
    d.line(outer_pts + [outer_pts[0]], fill=(198, 112, 38, 255), width=8)

    # 3. Thick puffy vanilla-strawberry poured sugar icing
    ic_sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(ic_sh).polygon([(x, y + 8) for (x, y) in icing_pts], fill=(182, 112, 54, 120))
    ic_sh = ic_sh.filter(ImageFilter.GaussianBlur(6))
    hi.alpha_composite(ic_sh)

    d.polygon(icing_pts, fill=(255, 240, 245, 255))
    # Glossy top highlight sheen inside icing
    hi_pts = star_poly(r_outer * 0.74, r_inner * 0.72)
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(x - 6, y - 10) for (x, y) in hi_pts], fill=(255, 255, 255, 115))
    sheen = sheen.filter(ImageFilter.GaussianBlur(8))
    imask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(imask).polygon(icing_pts, fill=255)
    hi.paste(Image.alpha_composite(hi, sheen), (0, 0), imask)

    # 4. Rainbow candy sprinkles around the star lobes!
    sprinkles = [
        (cx - 145, cy - 95, 25, (255, 92, 138)),
        (cx + 138, cy - 88, -32, (45, 212, 191)),
        (cx - 42, cy - 235, 65, (255, 212, 59)),
        (cx + 46, cy - 210, -20, (192, 132, 252)),
        (cx - 210, cy + 12, -55, (96, 165, 250)),
        (cx + 215, cy + 18, 40, (251, 146, 60)),
        (cx - 135, cy + 175, 18, (45, 212, 191)),
        (cx + 140, cy + 185, -45, (255, 92, 138)),
        (cx - 10, cy + 165, 12, (255, 212, 59)),
        (cx + 95, cy + 105, 58, (192, 132, 252)),
        (cx - 108, cy + 95, -40, (255, 212, 59)),
    ]
    for (sx, sy, deg, col) in sprinkles:
        ang = math.radians(deg)
        hl = 24
        dx, dy = math.cos(ang) * hl, math.sin(ang) * hl
        d.line([(sx - dx, sy - dy + 5), (sx + dx, sy + dy + 5)], fill=(180, 120, 140, 85), width=20)
        d.line([(sx - dx, sy - dy), (sx + dx, sy + dy)], fill=(*col, 255), width=18)
        for ex, ey in ((sx - dx, sy - dy), (sx + dx, sy + dy)):
            d.ellipse([ex - 9, ey - 9, ex + 9, ey + 9], fill=(*col, 255))

    # 5. Center hero glossy cherry-red gummy screw + 3 cute orbiting candy screws (yellow, teal, purple)
    screw_specs = [
        (1, cx, cy - 8, 250),         # Big cherry-red gummy screw dead center
        (2, cx - 230, cy - 170, 132), # Sunny yellow
        (8, cx + 235, cy - 155, 128), # Mint teal
        (5, cx + 205, cy + 215, 122), # Grape purple
    ]
    for cid, sx, sy, ssz in screw_specs:
        sp = os.path.join(DESSERT_DIR, f"dessert_screw{cid}.png")
        if not os.path.exists(sp):
            continue
        sc = Image.open(sp).convert("RGBA").resize((ssz, ssz), Image.Resampling.LANCZOS)
        # Warm soft shadow under screw
        ssh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        r_s = ssz // 2
        ImageDraw.Draw(ssh).ellipse([sx - r_s, sy - r_s + 14, sx + r_s, sy + r_s + 14], fill=(140, 52, 82, 105))
        ssh = ssh.filter(ImageFilter.GaussianBlur(10))
        hi.alpha_composite(ssh)
        hi.alpha_composite(sc, (sx - r_s, sy - r_s))

    return hi.resize((size, size), Image.Resampling.LANCZOS)


def generate_launch_and_icon_assets():
    bg_path = os.path.join(DESSERT_DIR, "bg_dessert_menu.jpg")
    logo_src = os.path.join(DESSERT_DIR, "logo_sweet_jam.png")
    bg_raw = Image.open(bg_path).convert("RGBA")
    logo_raw = Image.open(logo_src).convert("RGBA")

    # 1. Save splash_logo.png (high-res crisp Sweet Candy Logo)
    logo_raw.save(LOGO_PATH)

    cookie_hero = compose_sweet_cookie_badge(620)

    # 2. Portrait Launch Screen (1242 x 2688 — matches iPhone Pro/Max aspect ratio cleanly)
    PW, PH = 1242, 2688
    port = bg_raw.resize((PW, PH), Image.Resampling.LANCZOS)
    # Center cookie hero slightly above vertical midpoint
    ch_w, ch_h = cookie_hero.size
    port.alpha_composite(cookie_hero, ((PW - ch_w) // 2, int(PH * 0.41) - ch_h // 2 + 120))
    # Big glossy Sweet Candy logo above cookie hero
    lw = int(PW * 0.84)
    lh = int(lw * logo_raw.height / logo_raw.width)
    logo_port = logo_raw.resize((lw, lh), Image.Resampling.LANCZOS)
    port.alpha_composite(logo_port, ((PW - lw) // 2, int(PH * 0.19)))
    port_rgb = port.convert("RGB")
    port_rgb.save(os.path.join(LAUNCH_SRC_DIR, "LaunchScreenBackground.png"), optimize=True)
    port_rgb.save(os.path.join(LAUNCH_SRC_DIR, "LaunchScreenBackgroundPortrait.png"), optimize=True)

    # 3. Landscape Launch Screen (2208 x 1242)
    LW, LH = 2208, 1242
    # Center-crop & scale background softly
    land = bg_raw.resize((LW, int(LW * bg_raw.height / bg_raw.width)), Image.Resampling.LANCZOS)
    top_c = (land.height - LH) // 2
    land = land.crop((0, top_c, LW, top_c + LH))
    ch_sm = cookie_hero.resize((480, 480), Image.Resampling.LANCZOS)
    land.alpha_composite(ch_sm, ((LW - 480) // 2, 560))
    llw = 980
    llh = int(llw * logo_raw.height / logo_raw.width)
    land.alpha_composite(logo_raw.resize((llw, llh), Image.Resampling.LANCZOS), ((LW - llw) // 2, 160))
    land.convert("RGB").save(os.path.join(LAUNCH_SRC_DIR, "LaunchScreenBackgroundLandscape.png"), optimize=True)

    # 4. Upgrade AppIcon (1024x1024) to match the new Sweet Candy & Frosted Cookie aesthetic!
    IW = 1024
    # Crop warm luminous strawberry-pink square from bg_raw
    sq_bg = bg_raw.crop((0, int(bg_raw.height * 0.16), bg_raw.width, int(bg_raw.height * 0.16) + bg_raw.width))
    icon = sq_bg.resize((IW, IW), Image.Resampling.LANCZOS)
    # Soft warm pink outer radial tint so icon pops on both light and dark iOS wallpapers
    vig = Image.new("RGBA", (IW, IW), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, IW, IW], fill=(255, 164, 204, 48))
    vd.ellipse([110, 110, IW - 110, IW - 110], fill=(255, 250, 245, 72))
    vig = vig.filter(ImageFilter.GaussianBlur(70))
    icon = Image.alpha_composite(icon, vig)

    icon_cookie = compose_sweet_cookie_badge(900)
    icon.alpha_composite(icon_cookie, ((IW - 900) // 2, (IW - 900) // 2 + 12))
    icon_rgb = icon.convert("RGB")
    os.makedirs(os.path.dirname(STORE_ICON), exist_ok=True)
    icon_rgb.save(STORE_ICON, "PNG")

    # Populate all sizes in native/engine/ios/Images.xcassets/AppIcon.appiconset/
    for sz in (29, 40, 57, 58, 60, 80, 87, 114, 120, 180, 1024):
        dst = os.path.join(ICONSET_DIR, f"{sz}.png")
        if os.path.isdir(ICONSET_DIR):
            icon_rgb.resize((sz, sz), Image.Resampling.LANCZOS).save(dst, "PNG")
    # Sync Android mipmap launcher icons as well
    android_res = os.path.join(ROOT, "native", "engine", "android", "res")
    if os.path.isdir(android_res):
        for bucket, sz in (
            ("mipmap-mdpi", 48),
            ("mipmap-hdpi", 72),
            ("mipmap-xhdpi", 96),
            ("mipmap-xxhdpi", 144),
            ("mipmap-xxxhdpi", 192),
        ):
            bdir = os.path.join(android_res, bucket)
            if os.path.isdir(bdir):
                icon_rgb.resize((sz, sz), Image.Resampling.LANCZOS).save(
                    os.path.join(bdir, "ic_launcher.png"), "PNG"
                )
    print("[splash] generated Sweet Candy LaunchScreen backgrounds & 1024px AppIcon set!")


def restore_ios_launch_images():
    if not os.path.isdir(LAUNCH_SRC_DIR) or not os.path.isdir(IOS_NATIVE_DIR):
        return
    for name in (
        "LaunchScreenBackground.png",
        "LaunchScreenBackgroundPortrait.png",
        "LaunchScreenBackgroundLandscape.png",
    ):
        src = os.path.join(LAUNCH_SRC_DIR, name)
        dst = os.path.join(IOS_NATIVE_DIR, name)
        if os.path.isfile(src):
            shutil.copy2(src, dst)
            print(f"[splash] restored {os.path.relpath(dst, ROOT)}")


def patch_settings_json(settings_path: str, logo_data_uri: str, total_time: int):
    if not os.path.isfile(settings_path):
        return
    with open(settings_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["splashScreen"] = {
        "displayRatio": 0.56,
        "totalTime": total_time,
        "watermarkLocation": "default",
        "autoFit": True,
        "logo": {
            "type": "custom",
            "base64": logo_data_uri,
        },
        "background": {
            "type": "color",
            "color": {
                "x": 1.0,
                "y": 0.929,
                "z": 0.953,
                "w": 1.0,
            },
        },
    }
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"[splash] patched {os.path.relpath(settings_path, ROOT)} (totalTime={total_time})")


def patch_web_shell():
    css_path = os.path.join(ROOT, "build", "web-mobile", "style.css")
    if os.path.isfile(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()
        css = css.replace("background-color: #333;", "background-color: #FFEDF3;")
        with open(css_path, "w", encoding="utf-8") as f:
            f.write(css)

    html_path = os.path.join(ROOT, "build", "web-mobile", "index.html")
    if os.path.isfile(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
        html = html.replace("<title>Cocos Creator | screw-out</title>", "<title>Screw Out: Sweet Candy Jam</title>")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)


def main():
    generate_launch_and_icon_assets()
    restore_ios_launch_images()
    with open(LOGO_PATH, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")
    logo_uri = f"data:image/png;base64,{logo_b64}"

    patch_settings_json(os.path.join(ROOT, "build", "ios", "data", "src", "settings.json"), logo_uri, 0)
    patch_settings_json(os.path.join(ROOT, "build", "web-mobile", "src", "settings.json"), logo_uri, 900)
    patch_settings_json(os.path.join(ROOT, "build", "android", "data", "src", "settings.json"), logo_uri, 600)
    patch_settings_json(os.path.join(ROOT, "build", "android", "assets", "src", "settings.json"), logo_uri, 600)
    patch_web_shell()


if __name__ == "__main__":
    main()
