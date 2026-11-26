#!/usr/bin/env python3
"""
Migrate assets and 101 levels from decoded Cocos Creator 2.4.14 chailuosi-game
to Cocos Creator 3.8.6 ScrewOut project.
"""

import json
import math
import os
import shutil
from pathlib import Path
from PIL import Image

SRC_ROOT = Path("/Users/echo/.zcode/workspace/1795648286972-71fcf507-50ea-49a3-a9ff-225a808aaebc/chailuosi-game/assets")
DST_ROOT = Path("/Users/echo/workspace/CocosGames/ScrewOut/assets/resources")

BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASE64_VALUES = {ch: i for i, ch in enumerate(BASE64_KEYS)}


def decompress_uuid(u: str) -> str:
    """Decompress Cocos 2.4 22-char or 23-char base64 UUID to standard 32-hex (no dashes)."""
    if not isinstance(u, str):
        return ""
    clean = u.replace("-", "")
    if len(clean) == 32 and all(c in "0123456789abcdefABCDEF" for c in clean):
        return clean.lower()
    if len(u) == 22:
        prefix = u[:2]
        rest = u[2:]
    elif len(u) == 23:
        prefix = u[:5]
        rest = u[5:]
    else:
        return clean.lower()
    hex_chars = [prefix]
    for i in range(0, len(rest), 2):
        lhs = BASE64_VALUES.get(rest[i], 0)
        rhs = BASE64_VALUES.get(rest[i + 1], 0)
        hex_chars.append(f"{(lhs >> 2):x}")
        hex_chars.append(f"{(((lhs & 3) << 2) | (rhs >> 4)):x}")
        hex_chars.append(f"{(rhs & 0xF):x}")
    return "".join(hex_chars).lower()


def unpack_cc24_value(val, val_type):
    """Unpack Cocos 2.4 typed value arrays."""
    if not isinstance(val, list) or len(val) == 0:
        return val
    # ValueType enum in Cocos 2.4:
    # 0: Vec2 [0, x, y]
    # 1: Vec3 [1, x, y, z]
    # 2: Vec4 [2, x, y, z, w]
    # 3: Quat [3, x, y, z, w]
    # 4: Color [4, rgba_uint32]
    # 5: Size [5, w, h]
    # 6: Rect [6, x, y, w, h]
    # 7: Mat4
    # 8: ValueType (nested array of typed values, e.g. points: [[ [0,x,y], ... ], 8, 8, ...])
    # 9: TRS [x, y, z, rx, ry, rz, rw, sx, sy, sz]
    return val


def unpack_cc24(raw):
    """Unpack Cocos Creator 2.4 packed JSON into list of dicts."""
    if not isinstance(raw, list) or len(raw) < 6 or raw[0] != 1:
        return None
    uuids = raw[1]
    shared_strings = raw[2]
    classes = raw[3]
    masks = raw[4]
    instances = raw[5]
    refs = raw[7] if len(raw) > 7 and isinstance(raw[7], list) else []
    dep_objs = raw[8] if len(raw) > 8 and isinstance(raw[8], list) else []
    dep_keys = raw[9] if len(raw) > 9 and isinstance(raw[9], list) else []
    dep_uuids = raw[10] if len(raw) > 10 and isinstance(raw[10], list) else []

    objs = []
    # Keep track of nested inline objects for ref/depend binding!
    # In Cocos 2.4, negative numbers in fields are 1-based index into a flat placeholder list,
    # and `refs` is a flat stream: [owner_idx, prop_or_arr_idx, target_idx, ..., ref_offset]
    # Actually even simpler: let's track every object created (top-level + inline) via placeholder slots.
    # Let's implement the exact Cocos 2.4 deserialize algorithm!
    parsed_objs = [None] * len(instances)

    # First pass: parse each instance and collect inline objects
    # In Cocos 2.4 packed format, `dependObjs` contains indices into `instances` (if >= 0)
    # or into an inline-objects list? No! In 2.4, `instances` has top-level objects,
    # and negative integers like `-15` inside an instance are `refs` slots (slot index = -val - 1)!
    # Wait: let's verify: in `lv1`:
    # `refs` has triples `(owner, key, target)`? Look at lv1[7]:
    # `[0, 2, 1, 0, 0, 1, 0, -1, 76, 0, -2, 72, ...]`
    # Let's decode `refs` properly!
    # In Cocos 2.4 `pack-instance`:
    # `refs` = [target0, target1, ..., offset] where:
    # Actually `refs` is `[owner, key, target]`? No! Look closely at lv1[7]:
    # `0, 2, 1` -> owner=0? No, 0 is `cc.Prefab`, 1 is root `cc.Node`, 2 is `"大圆"`.
    # In lv1[5][1]: `[12,"lv_1",[-3,-4,-5,-6,-7,-8,-9,-10,-11,-12,-13],[[3,45,-2]],[22,-1,0],...]`
    # Look at the negative numbers: -1, -2, -3, ..., -13!
    # And look at lv1[7] at indices:
    #   slot 0 (-1): `0, 2, 1` -> prop `"root"` (shared_strings[2]), owner=0? No, `target=1`!
    #   slot 1 (-2): `0, 0, 1` -> prop `"node"` (shared_strings[0]), target=1!
    #   slot 2 (-3): `0, -1, 76` -> array item, target=76!
    #   slot 3 (-4): `0, -2, 72` -> array item, target=72!
    # YES!! Each 3 elements in `refs` is `(?, ?, target_instance_idx)`! Specifically:
    # `refs[i*3 + 2]` is the target instance index for placeholder `-(i + 1)`!
    # AND at the end of `refs`, there's a single trailing integer `refOffset` (like `637`), and before it are triples `(owner_idx, prop_idx_in_shared_strings, target_idx)` for direct property assignments!
    # Wait: let's check what `637` is: len(lv1[7])!

    def parse_obj(data):
        if isinstance(data, dict):
            return dict(data)
        if not isinstance(data, list) or len(data) == 0:
            return data
        mask_idx = data[0]
        if not isinstance(mask_idx, int) or mask_idx < 0 or mask_idx >= len(masks):
            return data
        mask = masks[mask_idx]
        cls_def = classes[mask[0]]
        cls_name = cls_def[0]
        cls_props = cls_def[1]
        obj = {"__type__": cls_name}
        # Last element of mask is propOffset (number of simple props; remaining are object/array props)
        prop_indices = mask[1:-1]
        for idx_pos, p_idx in enumerate(prop_indices):
            if idx_pos + 1 >= len(data):
                break
            prop_name = cls_props[p_idx]
            val = data[idx_pos + 1]
            # Recursively parse nested components / prefabInfo
            if prop_name == "_components" and isinstance(val, list):
                val = [parse_obj(c) for c in val]
            elif prop_name == "_prefab" and isinstance(val, list):
                val = parse_obj(val)
            obj[prop_name] = val
        return obj

    for i, inst in enumerate(instances):
        parsed_objs[i] = parse_obj(inst)

    # Resolve placeholders (negative integers in `_children`, `_parent`, `node`, `root`, etc.)
    # In Cocos 2.4, `refs` has a tail count `split = refs[-1]` (number of elements in the first part, which are triples for placeholders -(k+1)).
    # Wait: let's check both parts of `refs`:
    if refs:
        split = refs[-1] * 3
        def resolve_ref(v):
            if isinstance(v, int) and v < 0:
                slot = (-v - 1) * 3 + 2
                if 0 <= slot < split:
                    return refs[slot]
            return v

        for obj in parsed_objs:
            if not isinstance(obj, dict):
                continue
            if "_children" in obj and isinstance(obj["_children"], list):
                obj["_children"] = [resolve_ref(c) for c in obj["_children"]]
            if "_components" in obj and isinstance(obj["_components"], list):
                for comp in obj["_components"]:
                    if isinstance(comp, dict):
                        for k, v in list(comp.items()):
                            if k in ("node", "_parent", "root"):
                                comp[k] = resolve_ref(v)

        # Apply Part 2 triples (owner, shared_str_idx, target)
        i = split
        while i + 2 < len(refs) - 1:
            owner_idx = refs[i]
            key_idx = refs[i + 1]
            target_idx = refs[i + 2]
            if 0 <= owner_idx < len(parsed_objs) and 0 <= key_idx < len(shared_strings):
                parsed_objs[owner_idx][shared_strings[key_idx]] = target_idx
            i += 3

    # Resolve external UUIDs on components/objects!
    # In Cocos 2.4, for Sprite components, `_spriteFrame` has an integer index `N` into `dep_uuids`!
    # Specifically, `dep_uuids[N]` is the index into `uuids`!
    # Let's verify on lv1[5][2]: `cc.Sprite` has `[1, -15, [16], 17]` -> `_materials: [16]`, `_spriteFrame: 17`.
    # Look at `dep_uuids[17]` = `17` -> `uuids[17]`! Wait: `dep_uuids` has `[0, 16, 0, 1, 0, 1, ..., 0, 17, ...]`
    # Look at `dep_keys` (`raw[9]`): `[-1, 1, -1, 1, ...]` where `-1` is `_materials[0]` and `1` is `_spriteFrame` (`shared_strings[1]`)!
    # And `dep_uuids` (`raw[10]`): `[0, 16, 0, 1, ...]` where index 0 is `ecpdLyjv...` (material) and index 16 is spriteFrame uuid!
    # Wait: why did lv1[5][2] have `[16]` and `17`? Because `16` and `17` are indices into `dep_uuids`!!
    # Let's check: `dep_uuids[16] = 0` (material!), `dep_uuids[17] = 17` (`uuids[17]`)!
    # YES!! Any integer `idx` in `_spriteFrame` (or `_materials[0]`) is an index into `dep_uuids`, giving `uuids[dep_uuids[idx]]`!
    for obj in parsed_objs:
        if not isinstance(obj, dict):
            continue
        comps = obj.get("_components", [])
        if isinstance(comps, list):
            for comp in comps:
                if isinstance(comp, dict) and comp.get("__type__") == "cc.Sprite":
                    sf_idx = comp.get("_spriteFrame")
                    if isinstance(sf_idx, int) and 0 <= sf_idx < len(dep_uuids):
                        u_idx = dep_uuids[sf_idx]
                        if 0 <= u_idx < len(uuids):
                            comp["_spriteFrameUuid"] = decompress_uuid(uuids[u_idx])

    return parsed_objs


def build_sprite_index():
    """Scan all spriteframe json files and native pngs in MainBdl."""
    main_bdl = SRC_ROOT / "MainBdl"
    # 1. Index all native PNGs by uuid (32-hex) and short hash (e.g. 1155bc032)
    tex_files = {}
    for root, _, files in os.walk(main_bdl):
        for fn in files:
            if fn.endswith(".png") or fn.endswith(".jpg"):
                full = Path(root) / fn
                stem = full.stem
                tex_files[stem.lower()] = full
                tex_files[stem.replace("-", "").lower()] = full

    # Also read MANIFEST.csv to map Texture2D uuid -> native png path
    manifest_path = SRC_ROOT / "MANIFEST.csv"
    uuid_to_file = {}
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            next(f)
            for line in f:
                parts = line.strip().split(",")
                if len(parts) >= 5:
                    bundle, res_path, typ, uid, rel_file = parts[:5]
                    uid_clean = uid.replace("-", "").lower()
                    full = SRC_ROOT / rel_file
                    if typ == "native" and full.exists():
                        tex_files[uid_clean] = full
                    if full.exists():
                        uuid_to_file[uid_clean] = (res_path, typ, full)

    # 2. Parse all spriteframe JSONs (including _subassets where MANIFEST type is "c")
    sf_by_uuid = {}
    sf_by_name = {}
    for uid_clean, (res_path, typ, full) in uuid_to_file.items():
        if not str(full).endswith(".json"):
            continue
        if typ not in ("cc.SpriteFrame", "c"):
            continue
        try:
            raw = json.loads(full.read_text("utf-8"))
        except Exception:
            continue
        if not isinstance(raw, list) or len(raw) < 6:
            continue
        if raw[3] != ["cc.SpriteFrame"]:
            continue
        uuids = raw[1]
        data_list = raw[5]
        if not data_list:
            continue
        d = data_list[0]
        tex_idx = 0
        if isinstance(d, list) and len(d) > 0 and isinstance(d[0], dict):
            d = d[0]
            if len(data_list) >= 6 and isinstance(data_list[5], list) and len(data_list[5]) > 0:
                tex_idx = int(data_list[5][0])
        elif len(raw) >= 11 and isinstance(raw[10], list) and len(raw[10]) > 0:
            tex_idx = int(raw[10][0])
        if not isinstance(d, dict):
            continue
        tex_ref = uuids[tex_idx] if 0 <= tex_idx < len(uuids) else (uuids[0] if uuids else "")
        tex_uuid = decompress_uuid(tex_ref) if len(tex_ref) >= 22 else tex_ref.lower()
        info = {
            "uuid": uid_clean,
            "name": d.get("name", Path(res_path).name if res_path else uid_clean[:8]),
            "resPath": res_path,
            "texRef": tex_ref.lower(),
            "texUuid": tex_uuid,
            "rect": d.get("rect", [0, 0, 0, 0]),
            "offset": d.get("offset", [0, 0]),
            "originalSize": d.get("originalSize", [0, 0]),
            "rotated": bool(d.get("rotated", 0)),
        }
        sf_by_uuid[uid_clean] = info
        if info["name"]:
            sf_by_name[info["name"]] = info

    return tex_files, sf_by_uuid, sf_by_name


def crop_sprite(info, tex_files, out_path: Path) -> bool:
    """Crop a sprite from its source texture/atlas PNG and save with originalSize."""
    tex_path = tex_files.get(info["texUuid"]) or tex_files.get(info["texRef"])
    if not tex_path or not tex_path.exists():
        return False
    x, y, w, h = info["rect"]
    rotated = info["rotated"]
    if w <= 0 or h <= 0:
        return False
    with Image.open(tex_path) as im:
        im = im.convert("RGBA")
        if rotated:
            # In Cocos 2.4, rotated sprite frames are rotated 90 deg CW in atlas (box is h x w); rotate +90 (CCW) to restore upright
            crop_box = (int(x), int(y), int(x + h), int(y + w))
            cropped = im.crop(crop_box).rotate(90, expand=True)
        else:
            crop_box = (int(x), int(y), int(x + w), int(y + h))
            cropped = im.crop(crop_box)

        orig_w, orig_h = info["originalSize"]
        off_x, off_y = info["offset"]
        orig_w = int(round(orig_w)) if orig_w > 0 else cropped.width
        orig_h = int(round(orig_h)) if orig_h > 0 else cropped.height

        if orig_w == cropped.width and orig_h == cropped.height and abs(off_x) < 1 and abs(off_y) < 1:
            canvas = cropped
        else:
            canvas = Image.new("RGBA", (orig_w, orig_h), (0, 0, 0, 0))
            # Cocos offset is from center of originalSize to center of trimmed rect (Y up!)
            paste_x = int(round((orig_w - cropped.width) / 2 + off_x))
            paste_y = int(round((orig_h - cropped.height) / 2 - off_y))
            canvas.paste(cropped, (paste_x, paste_y))

        out_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(out_path)
    return True


def extract_trs(node):
    """Extract pos [x,y], angle (deg), scale [sx,sy] from Cocos 2.4 _trs / _eulerAngles."""
    trs = node.get("_trs")
    pos = [0.0, 0.0]
    scale = [1.0, 1.0]
    angle = 0.0
    if isinstance(trs, list) and len(trs) >= 10:
        pos = [round(float(trs[0]), 3), round(float(trs[1]), 3)]
        qx, qy, qz, qw = float(trs[3]), float(trs[4]), float(trs[5]), float(trs[6])
        # Z rotation from quaternion
        siny = 2.0 * (qw * qz + qx * qy)
        cosy = 1.0 - 2.0 * (qy * qy + qz * qz)
        angle = round(math.degrees(math.atan2(siny, cosy)), 3)
        scale = [round(float(trs[7]), 4), round(float(trs[8]), 4)]
    euler = node.get("_eulerAngles")
    if isinstance(euler, list) and len(euler) >= 4:
        # [1, ex, ey, ez]
        angle = round(float(euler[3]), 3)
    return pos, angle, scale


def extract_size(node):
    sz = node.get("_contentSize")
    if isinstance(sz, list) and len(sz) >= 3:
        return [round(float(sz[1]), 2), round(float(sz[2]), 2)]
    return [0.0, 0.0]


def extract_polygon(node):
    comps = node.get("_components", [])
    poly_pts = None
    for comp in comps:
        if not isinstance(comp, dict):
            continue
        t = comp.get("__type__", "")
        if t in ("cc.PolygonCollider", "cc.PhysicsPolygonCollider"):
            pts_raw = comp.get("points")
            if isinstance(pts_raw, list) and len(pts_raw) > 0:
                # Packed format: [ [ [0, x, y], [0, x, y], ... ], 8, 8, ... ]
                arr = pts_raw[0] if isinstance(pts_raw[0], list) else pts_raw
                pts = []
                for p in arr:
                    if isinstance(p, list) and len(p) >= 3:
                        pts.append([round(float(p[1]), 2), round(float(p[2]), 2)])
                if len(pts) >= 3:
                    poly_pts = pts
                    if t == "cc.PolygonCollider":
                        break
    return poly_pts


def extract_sprite_uuid(node):
    for comp in node.get("_components", []):
        if isinstance(comp, dict) and comp.get("__type__") == "cc.Sprite":
            return comp.get("_spriteFrameUuid", "")
    return ""


def parse_level_prefab(prefab_path: Path, sf_by_uuid: dict, used_board_sfs: dict):
    raw = json.loads(prefab_path.read_text("utf-8"))
    objs = unpack_cc24(raw)
    if not objs or len(objs) < 2:
        raise ValueError(f"Failed to unpack {prefab_path}")
    root = objs[1]
    layers = []
    total_holes = 0

    for layer_idx in root.get("_children", []):
        if not isinstance(layer_idx, int) or layer_idx >= len(objs):
            continue
        layer_node = objs[layer_idx]
        if not isinstance(layer_node, dict) or layer_node.get("__type__") != "cc.Node":
            continue
        boards = []
        for board_idx in layer_node.get("_children", []):
            if not isinstance(board_idx, int) or board_idx >= len(objs):
                continue
            b_node = objs[board_idx]
            if not isinstance(b_node, dict) or b_node.get("__type__") != "cc.Node":
                continue

            pos, angle, scale = extract_trs(b_node)
            size = extract_size(b_node)
            polygon = extract_polygon(b_node)
            frame_uuid = extract_sprite_uuid(b_node)
            frame_name = ""
            if frame_uuid and frame_uuid in sf_by_uuid:
                sf = sf_by_uuid[frame_uuid]
                frame_name = f"b_{frame_uuid[:8]}"
                used_board_sfs[frame_name] = sf

            board_sprite_name = ""
            board_child_size = size
            board_child_pos = [0.0, 0.0]
            board_child_angle = 0.0
            holes = []

            for c_idx in b_node.get("_children", []):
                if not isinstance(c_idx, int) or c_idx >= len(objs):
                    continue
                c_node = objs[c_idx]
                if not isinstance(c_node, dict):
                    continue
                cname = c_node.get("_name", "")
                if cname == "board":
                    b_uuid = extract_sprite_uuid(c_node)
                    if b_uuid and b_uuid in sf_by_uuid:
                        sf = sf_by_uuid[b_uuid]
                        board_sprite_name = f"b_{b_uuid[:8]}"
                        used_board_sfs[board_sprite_name] = sf
                    csz = extract_size(c_node)
                    if csz[0] > 0 and csz[1] > 0:
                        board_child_size = csz
                    cpos, cang, _ = extract_trs(c_node)
                    board_child_pos = cpos
                    board_child_angle = cang
                elif cname == "hoesNode":
                    for h_idx in c_node.get("_children", []):
                        if isinstance(h_idx, int) and h_idx < len(objs):
                            h_node = objs[h_idx]
                            hpos, _, _ = extract_trs(h_node)
                            holes.append(hpos)

            total_holes += len(holes)
            boards.append({
                "name": b_node.get("_name", "board"),
                "pos": pos,
                "angle": angle,
                "scale": scale,
                "size": size,
                "frameSprite": frame_name,
                "boardSprite": board_sprite_name,
                "boardSize": board_child_size,
                "boardPos": board_child_pos,
                "boardAngle": board_child_angle,
                "polygon": polygon or [],
                "holes": holes,
            })

        if boards:
            layers.append({
                "name": layer_node.get("_name", f"layer_{len(layers)}"),
                "boards": boards,
            })

    return {
        "name": prefab_path.stem,
        "totalHoles": total_holes,
        "layers": layers,
    }


def migrate_spine(src_dir: Path, dst_dir: Path, base_name: str):
    """Unpack Cocos 2.4 .skeletondata.json into standard Spine .json + copy .atlas and .png."""
    sk_file = src_dir / f"{base_name}.skeletondata.json"
    if not sk_file.exists():
        return False
    raw = json.loads(sk_file.read_text("utf-8"))
    # In Cocos 2.4 sp.SkeletonData packed JSON, raw[5][0] is [0, name, atlasText, textures, skeletonJson, ...]
    # Find the dict inside raw[5][0] that has "skeleton" or "bones"
    spine_json = None
    if isinstance(raw, list) and len(raw) >= 6 and isinstance(raw[5], list) and len(raw[5]) > 0:
        entry = raw[5][0]
        if isinstance(entry, list):
            for item in entry:
                if isinstance(item, dict) and ("skeleton" in item or "bones" in item):
                    spine_json = item
                    break
        elif isinstance(entry, dict) and ("skeleton" in entry or "bones" in entry):
            spine_json = entry

    dst_dir.mkdir(parents=True, exist_ok=True)
    if spine_json:
        (dst_dir / f"{base_name}.json").write_text(json.dumps(spine_json, separators=(",", ":")), encoding="utf-8")
    for ext_file in src_dir.iterdir():
        if ext_file.suffix in (".atlas", ".png"):
            shutil.copy2(ext_file, dst_dir / ext_file.name)
    return spine_json is not None


def main():
    print("Building sprite index from MainBdl...")
    tex_files, sf_by_uuid, sf_by_name = build_sprite_index()
    print(f"Indexed {len(tex_files)} texture keys, {len(sf_by_uuid)} sprite frames.")

    # 1. Convert all 101 levels
    levels_src = SRC_ROOT / "MainBdl/cfzs/prefabs/levels"
    levels_dst = DST_ROOT / "levels"
    levels_dst.mkdir(parents=True, exist_ok=True)

    used_board_sfs = {}
    level_stats = []
    for lv_num in range(101):
        p = levels_src / f"lv_{lv_num}.prefab"
        if not p.exists():
            print(f"WARNING: missing {p}")
            continue
        lv_data = parse_level_prefab(p, sf_by_uuid, used_board_sfs)
        (levels_dst / f"lv_{lv_num}.json").write_text(
            json.dumps(lv_data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        level_stats.append((lv_num, len(lv_data["layers"]), sum(len(l["boards"]) for l in lv_data["layers"]), lv_data["totalHoles"]))

    print(f"Converted {len(level_stats)} levels. Sample:")
    for st in level_stats[:5]:
        print(f"  lv_{st[0]}: {st[1]} layers, {st[2]} boards, {st[3]} holes")
    bad_mod3 = [st for st in level_stats if st[3] == 0 or st[3] % 3 != 0]
    print(f"Levels with 0 or non-mod-3 holes: {len(bad_mod3)} {bad_mod3[:5]}")

    # 2. Export board shape sprites
    boards_dst = DST_ROOT / "sprites/boards"
    boards_dst.mkdir(parents=True, exist_ok=True)
    ok_boards = 0
    for name, sf in used_board_sfs.items():
        if crop_sprite(sf, tex_files, boards_dst / f"{name}.png"):
            ok_boards += 1
    print(f"Exported {ok_boards}/{len(used_board_sfs)} unique board shape PNGs.")

    # 3. Export game sprites (screws, boxes, covers, hole, frame, etc.)
    games_dst = DST_ROOT / "sprites/games"
    games_dst.mkdir(parents=True, exist_ok=True)
    wanted_games = (
        [f"gbz_screw{i}" for i in range(1, 12)]
        + [f"gbz_box{i}" for i in range(0, 11)]
        + [f"gbz_cover{i}" for i in range(1, 11)]
        + ["frame", "hole"]
        + [f"UI_sb_{i}" for i in range(1, 6)]
        + [f"UI_sl_{i}" for i in range(1, 6)]
    )
    ok_games = 0
    for name in wanted_games:
        sf = sf_by_name.get(name)
        if sf and crop_sprite(sf, tex_files, games_dst / f"{name}.png"):
            ok_games += 1
        else:
            # Fallback: check direct png in cfzs/images
            direct = SRC_ROOT / f"MainBdl/cfzs/images/{name}.png"
            if direct.exists():
                shutil.copy2(direct, games_dst / f"{name}.png")
                ok_games += 1
    print(f"Exported {ok_games}/{len(wanted_games)} game sprites.")

    # 4. Write difficulty.json
    cfg_dst = DST_ROOT / "config"
    cfg_dst.mkdir(parents=True, exist_ok=True)
    difficulty = [
        {"difficulty": "简单", "color_count": [4, 5, 6, 7, 8, 9, 10], "progress": [15, 20, 30, 40, 50, 60, 100]},
        {"difficulty": "正常", "color_count": [4, 5, 6, 7, 8, 9, 10], "progress": [10, 20, 25, 30, 40, 55, 100]},
        {"difficulty": "困难", "color_count": [4, 5, 6, 7, 8, 9, 10], "progress": [10, 15, 25, 30, 35, 40, 100]},
        {"difficulty": "极难", "color_count": [5, 6, 7, 8, 9, 9, 10], "progress": [10, 15, 25, 30, 35, 40, 100]},
    ]
    (cfg_dst / "difficulty.json").write_text(json.dumps(difficulty, ensure_ascii=False, indent=2), encoding="utf-8")

    # 5. Copy audio files
    audio_src = SRC_ROOT / "MainBdl/audio"
    audio_dst = DST_ROOT / "audio"
    audio_dst.mkdir(parents=True, exist_ok=True)
    audio_count = 0
    for f in audio_src.glob("*.mp3"):
        shutil.copy2(f, audio_dst / f.name)
        audio_count += 1
    print(f"Copied {audio_count} audio clips.")

    # 6. Migrate Spine assets (nail + touch)
    ok_nail = migrate_spine(SRC_ROOT / "MainBdl/spine/screw", DST_ROOT / "spine/screw", "nail")
    ok_touch = migrate_spine(SRC_ROOT / "MainBdl/cfzs/spine", DST_ROOT / "spine/touch", "touch")
    print(f"Migrated Spine assets: nail={ok_nail}, touch={ok_touch}")


if __name__ == "__main__":
    main()
