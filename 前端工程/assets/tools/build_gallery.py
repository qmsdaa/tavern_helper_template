# -*- coding: utf-8 -*-
"""画廊素材一键构建：扫描 画廊/ 里的图片，压缩为 webp 并生成界面数据文件。

用法：
    python assets/tools/build_gallery.py           # 只压缩图片 + 生成数据
    python assets/tools/build_gallery.py --build   # 之后顺带执行 pnpm build

免改代码工作流：
    1. 把 CG 图片（jpg / png / webp）放进 assets/Counterfeit/开场白/画廊/
    2. （可选）在同目录 说明.txt 里按「文件名=标题|说明」填文案
    3. 运行本脚本 → 压缩图写入 画廊/已压缩/，数据写入 src/.../gallery.generated.ts
    4. pnpm build 后界面即更新
"""
import os
import re
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tavern_helper_template/
GALLERY_DIR = os.path.join(ROOT, "assets", "Counterfeit", "开场白", "画廊")
OUT_DIR = os.path.join(GALLERY_DIR, "已压缩")
CAPTIONS_FILE = os.path.join(GALLERY_DIR, "说明.txt")
GENERATED_TS = os.path.join(ROOT, "src", "Counterfeit", "界面", "开场白", "gallery.generated.ts")

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_WIDTH = 1600
QUALITY = 82


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def load_captions():
    captions = {}
    if not os.path.exists(CAPTIONS_FILE):
        return captions
    with open(CAPTIONS_FILE, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, rest = line.partition("=")
            title, _, caption = rest.partition("|")
            captions[key.strip()] = (title.strip(), caption.strip())
    return captions


def has_alpha(img):
    if img.mode in ("RGBA", "LA"):
        return img.getextrema()[-1][0] < 255
    return img.mode == "P" and "transparency" in img.info


def process(name):
    src = os.path.join(GALLERY_DIR, name)
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
    captions = load_captions()
    names = sorted(
        (
            n
            for n in os.listdir(GALLERY_DIR)
            if os.path.isfile(os.path.join(GALLERY_DIR, n)) and os.path.splitext(n)[1].lower() in IMG_EXTS
        ),
        key=natural_key,
    )

    items = []
    for name in names:
        stem = os.path.splitext(name)[0]
        out_name, kb = process(name)
        title, caption = captions.get(stem, captions.get(name, (stem, "")))
        items.append((out_name, title, caption))
        print(f"  {name} -> 已压缩/{out_name} ({kb}KB) · {title}")

    lines = [
        "// 本文件由 assets/tools/build_gallery.py 自动生成，请勿手改（改文案用 画廊/说明.txt）",
        "export interface GeneratedGalleryItem {",
        "  image: string;",
        "  title: string;",
        "  caption: string;",
        "}",
        "",
        "export const GENERATED_GALLERY_ITEMS: GeneratedGalleryItem[] = [",
    ]
    for out_name, title, caption in items:
        lines.append(
            "  { image: '画廊/已压缩/%s', title: '%s', caption: '%s' },"
            % (ts_escape(out_name), ts_escape(title), ts_escape(caption))
        )
    lines.append("];")
    lines.append("")
    with open(GENERATED_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"已生成 gallery.generated.ts（{len(items)} 项）")

    if not items:
        print("提示：画廊文件夹还没有图片，界面将显示占位帧。")
    if "--build" in sys.argv:
        print("执行 pnpm build ...")
        subprocess.run(["pnpm", "build"], cwd=ROOT, shell=True, check=True)
    else:
        print("下一步：cd tavern_helper_template && pnpm build（或加 --build 参数一步到位）")


if __name__ == "__main__":
    main()
