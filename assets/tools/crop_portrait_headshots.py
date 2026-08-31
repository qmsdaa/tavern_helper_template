# -*- coding: utf-8 -*-
"""Counterfeit 状态栏头像构建：全角色新立绘 → 512×512 WebP 头肩头像。

只读取 ``图片素材/角色立绘/全角色立绘``，不会覆盖源 PNG。默认输出到
``tavern_helper_template/assets/Counterfeit/状态栏/avatars``。裁切参数是相对坐标，
在不同分辨率（3328×4864 / 1408×2048）上保持一致。
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


SCRIPT_PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_SIZE = 512


@dataclass(frozen=True)
class PortraitJob:
    source: str
    output: str
    center_x: float = 0.50
    center_y: float = 0.18
    span: float = 0.34


JOBS = (
    PortraitJob("一色彩羽立绘.png", "iroha.webp"),
    PortraitJob("三浦优美子.png", "yumiko.webp"),
    PortraitJob("叶山隼人.png", "hayama.webp"),
    PortraitJob("平冢静.png", "shizuka.webp"),
    PortraitJob("户冢彩加.png", "saika.webp"),
    PortraitJob("拉芙希妮.png", "laff.webp"),
    PortraitJob("比企谷八幡立绘.png", "hachiman.webp"),
    PortraitJob("比企谷小町.png", "komachi.webp"),
    PortraitJob("爱布拉娜立绘 .png", "eblana.webp"),
    PortraitJob("由比滨结衣新立绘.png", "yui.webp"),
    PortraitJob("雪之下阳乃.png", "haruno.webp"),
    PortraitJob("雪之下雪乃.png", "yukino.webp"),
    PortraitJob("川崎沙希立绘.png", "saki.webp"),
    PortraitJob("性转比企谷八幡.png", "genderbend_hachiman.webp", center_y=0.16),
    PortraitJob("雪之下夫人.png", "mrs_yukinoshita.webp", center_y=0.17),
    # 2026-08-17 追加：配角立绘（源目录=工程根/配角立绘，统一 832×1216，用 --only 单跑）
    PortraitJob("材木座义辉.png", "zaimokuza.webp"),
    PortraitJob("海老名姬菜.png", "ebina.webp"),
    PortraitJob("相模南.png", "sagami.webp"),
    PortraitJob("折本香织.png", "orimoto.webp"),
    PortraitJob("户部翔.png", "tobe.webp"),
)


def crop_square(image: Image.Image, job: PortraitJob) -> tuple[Image.Image, tuple[int, int, int, int]]:
    width, height = image.size
    side = min(width, height, round(height * job.span))
    center_x = round(width * job.center_x)
    center_y = round(height * job.center_y)
    left = max(0, min(center_x - side // 2, width - side))
    top = max(0, min(center_y - side // 2, height - side))
    box = (left, top, left + side, top + side)
    cropped = image.crop(box).resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)
    return cropped, box


def build_avatar(source_root: Path, output_root: Path, job: PortraitJob) -> tuple[Path, tuple[int, int, int, int]]:
    source_path = source_root / job.source
    if not source_path.is_file():
        raise FileNotFoundError(f"缺少源立绘：{source_path}")
    with Image.open(source_path) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGBA")
    avatar, box = crop_square(image, job)
    output_root.mkdir(parents=True, exist_ok=True)
    output_path = output_root / job.output
    avatar.save(output_path, "WEBP", quality=88, method=6)
    with Image.open(output_path) as check:
        check.load()
        if check.size != (OUTPUT_SIZE, OUTPUT_SIZE):
            raise RuntimeError(f"头像尺寸错误：{output_path} -> {check.size}")
    return output_path, box


def build_contact_sheet(output_root: Path, output_paths: list[Path]) -> Path:
    cell = 256
    label_height = 34
    columns = 4
    rows = (len(output_paths) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell, rows * (cell + label_height)), "#f7f2f5")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, path in enumerate(output_paths):
        x = (index % columns) * cell
        y = (index // columns) * (cell + label_height)
        with Image.open(path) as opened:
            tile = opened.convert("RGB").resize((cell, cell), Image.Resampling.LANCZOS)
        sheet.paste(tile, (x, y))
        draw.text((x + 8, y + cell + 8), path.stem, fill="#4a3b42", font=font)
    contact_path = output_root / "_contact-sheet.jpg"
    sheet.save(contact_path, "JPEG", quality=90, optimize=True)
    return contact_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-root",
        type=Path,
        default=SCRIPT_PROJECT_ROOT / "图片素材" / "角色立绘" / "全角色立绘",
        help="新立绘源目录",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=SCRIPT_PROJECT_ROOT / "tavern_helper_template" / "assets" / "Counterfeit" / "状态栏" / "avatars",
        help="WebP 头像输出目录",
    )
    parser.add_argument("--contact-sheet", action="store_true", help="额外生成 _contact-sheet.jpg 供人工审查")
    parser.add_argument(
        "--only",
        type=str,
        default="",
        help="只处理逗号分隔的输出键（如 zaimokuza,ebina），用于配角补跑",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    only = {key.strip() for key in args.only.split(",") if key.strip()}
    jobs = [job for job in JOBS if not only or job.output.rsplit(".", 1)[0] in only]
    if only and len(jobs) != len(only):
        raise RuntimeError(f"--only 存在未知键：{sorted(only - {job.output.rsplit('.', 1)[0] for job in JOBS})}")
    outputs: list[Path] = []
    for job in jobs:
        output_path, box = build_avatar(args.source_root, args.output_root, job)
        outputs.append(output_path)
        print(f"{job.source} -> {output_path.name} crop={box} bytes={output_path.stat().st_size}")
    if len(outputs) != len(jobs):
        raise RuntimeError(f"应生成 {len(jobs)} 个头像，实际 {len(outputs)} 个")
    if args.contact_sheet:
        print(f"contact_sheet={build_contact_sheet(args.output_root, outputs)}")


if __name__ == "__main__":
    main()
