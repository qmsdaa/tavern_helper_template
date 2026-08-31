# -*- coding: utf-8 -*-
"""将 Counterfeit 全角色源立绘转换为状态栏/DLC 使用的透明 WebP。

源 PNG 只读；输出最长边限制为 2048，保留透明通道与完整构图。
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = PROJECT_ROOT / "图片素材" / "角色立绘" / "全角色立绘"
OUTPUT_ROOT = PROJECT_ROOT / "tavern_helper_template" / "assets" / "Counterfeit" / "状态栏" / "portraits"
MAX_EDGE = 2048


@dataclass(frozen=True)
class PortraitJob:
    source: str
    output: str


JOBS = (
    PortraitJob("性转比企谷八幡.png", "genderbend_hachiman.webp"),
    PortraitJob("雪之下夫人.png", "mrs_yukinoshita.webp"),
    # 2026-08-17 追加：配角立绘（源目录=工程根/配角立绘，统一 832×1216，用 --only 单跑）
    PortraitJob("材木座义辉.png", "zaimokuza.webp"),
    PortraitJob("海老名姬菜.png", "ebina.webp"),
    PortraitJob("相模南.png", "sagami.webp"),
    PortraitJob("折本香织.png", "orimoto.webp"),
    PortraitJob("户部翔.png", "tobe.webp"),
)


def build(job: PortraitJob, source_root: Path = SOURCE_ROOT, output_root: Path = OUTPUT_ROOT) -> Path:
    source = source_root / job.source
    if not source.is_file():
        raise FileNotFoundError(f"缺少源立绘：{source}")
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGBA")
    if max(image.size) > MAX_EDGE:
        scale = MAX_EDGE / max(image.size)
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )
    output_root.mkdir(parents=True, exist_ok=True)
    output = output_root / job.output
    image.save(output, "WEBP", quality=88, method=6)
    with Image.open(output) as check:
        check.load()
        if max(check.size) > MAX_EDGE or check.mode != "RGBA":
            raise RuntimeError(f"立绘产物错误：{output} size={check.size} mode={check.mode}")
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=SOURCE_ROOT, help="立绘源目录")
    parser.add_argument("--output-root", type=Path, default=OUTPUT_ROOT, help="WebP 立绘输出目录")
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
    for job in jobs:
        output = build(job, args.source_root, args.output_root)
        with Image.open(output) as check:
            print(f"{job.source} -> {output.name} {check.width}x{check.height} {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
