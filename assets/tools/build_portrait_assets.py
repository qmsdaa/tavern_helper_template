# -*- coding: utf-8 -*-
"""将 Counterfeit 全角色源立绘转换为状态栏/DLC 使用的透明 WebP。

源 PNG 只读；输出最长边限制为 2048，保留透明通道与完整构图。
"""

from __future__ import annotations

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
)


def build(job: PortraitJob) -> Path:
    source = SOURCE_ROOT / job.source
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
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_ROOT / job.output
    image.save(output, "WEBP", quality=88, method=6)
    with Image.open(output) as check:
        check.load()
        if max(check.size) > MAX_EDGE or check.mode != "RGBA":
            raise RuntimeError(f"立绘产物错误：{output} size={check.size} mode={check.mode}")
    return output


def main() -> None:
    for job in JOBS:
        output = build(job)
        with Image.open(output) as check:
            print(f"{job.source} -> {output.name} {check.width}x{check.height} {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
