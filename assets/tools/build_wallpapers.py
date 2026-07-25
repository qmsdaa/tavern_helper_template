# -*- coding: utf-8 -*-
"""手机壁纸一键构建：扫描 手机/壁纸/ 里的图片，压缩为 webp 并生成壁纸清单。

用法：
    python assets/tools/build_wallpapers.py           # 只压缩图片 + 生成数据
    python assets/tools/build_wallpapers.py --build   # 之后顺带执行 pnpm build
"""
import os
import re
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tavern_helper_template/
WALL_DIR = os.path.join(ROOT, "assets", "Counterfeit", "手机", "壁纸")
OUT_DIR = os.path.join(WALL_DIR, "已压缩")
GENERATED_TS = os.path.join(ROOT, "src", "Counterfeit", "界面", "手机", "wallpapers.generated.ts")

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_WIDTH = 1080
QUALITY = 82


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def has_alpha(img):
    if img.mode in ("RGBA", "LA"):
        return img.getextrema()[-1][0] < 255
    return img.mode == "P" and "transparency" in img.info


def process(name):
    src = os.path.join(WALL_DIR, name)
    stem = os.path.splitext(name)[0]
    out_name = f"{stem}.webp"
    dst = os.path.join(OUT_DIR, out_name)
    img = Image.open(src)
    img = img.convert("RGBA" if has_alpha(img) else "RGB")
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    img.save(dst, "WEBP", quality=QUALITY)
    return out_name, os.path.getsize(dst) // 1024


def ts_escape(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    names = sorted(
        (
            n
            for n in os.listdir(WALL_DIR)
            if os.path.isfile(os.path.join(WALL_DIR, n)) and os.path.splitext(n)[1].lower() in IMG_EXTS
        ),
        key=natural_key,
    )

    items = []
    for name in names:
        stem = os.path.splitext(name)[0]
        out_name, kb = process(name)
        items.append((out_name, stem))
        print(f"  {name} -> 已压缩/{out_name} ({kb}KB)")

    lines = [
        "// 本文件由 assets/tools/build_wallpapers.py 自动生成，请勿手改",
        "export interface GeneratedWallpaper {",
        "  image: string;",
        "  name: string;",
        "}",
        "",
        "export const GENERATED_WALLPAPERS: GeneratedWallpaper[] = [",
    ]
    for out_name, stem in items:
        lines.append("  { image: '手机/壁纸/已压缩/%s', name: '%s' }," % (ts_escape(out_name), ts_escape(stem)))
    lines.append("];")
    lines.append("")
    with open(GENERATED_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"已生成 wallpapers.generated.ts（{len(items)} 项）")

    if not items:
        print("提示：壁纸文件夹还没有图片，手机壁纸库将只有默认壁纸。")
    if "--build" in sys.argv:
        print("执行 pnpm build ...")
        subprocess.run(["pnpm", "build"], cwd=ROOT, shell=True, check=True)
    else:
        print("下一步：cd tavern_helper_template && pnpm build（或加 --build 参数一步到位）")


if __name__ == "__main__":
    main()
