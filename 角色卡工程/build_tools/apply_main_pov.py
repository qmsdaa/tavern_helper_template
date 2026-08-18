# -*- coding: utf-8 -*-
"""把《主场POV标注表》写回 150 个场景条目。

两件事（语义不同，互不覆盖）：
  1. 新增 `主场POV:` —— 这场戏的戏剧重心归属（标注表内容）
  2. 规范化已有 `POV:` —— 运行时叙事视点字段，统一为全名口径

用法：
    python build_tools/apply_main_pov.py --dry-run
    python build_tools/apply_main_pov.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

CARD_ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = CARD_ROOT / "世界书" / "事件"
TABLE = CARD_ROOT / "docs" / "主场POV标注表-待审.md"
REPORT = CARD_ROOT / "build_tools" / "_main_pov_report.txt"

# 标注表简称 → 全名（用户确认口径：全名）
FULL = {
    "拉芙": "拉芙希妮·都柏林",
    "拉芙希妮": "拉芙希妮·都柏林",
    "雪乃": "雪之下雪乃",
    "八幡": "比企谷八幡",
    "结衣": "由比滨结衣",
    "小町": "比企谷小町",
    "平冢静": "平冢静",
    "平冢": "平冢静",
    "爱布拉娜": "爱布拉娜·都柏林",
    "一色": "一色彩羽",
}
SHARED = "共享场景／零POV"

CN_DIGIT = {"零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}


def cn_to_int(s: str) -> int:
    """把「一百四十八」这类中文数字转成 int（范围 1..150）。"""
    s = s.replace("场景", "").strip()
    total, section, has_hundred = 0, 0, False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch in CN_DIGIT:
            section = CN_DIGIT[ch]
        elif ch == "十":
            section = (section or 1) * 10
            total += section
            section = 0
        elif ch == "百":
            has_hundred = True
            total += (section or 1) * 100
            section = 0
        i += 1
    total += section
    if has_hundred and total % 100 == 0:
        pass
    return total


def norm_main_pov(raw: str) -> str:
    """标注表取值 → 落盘取值。"""
    raw = raw.strip()
    if raw in ("共享", "共享/群像", "零POV"):
        return SHARED
    parts = [p.strip() for p in raw.split("×") if p.strip()]
    out = []
    for p in parts:
        if p in ("共享", "零POV"):
            out.append(SHARED)
        elif p in FULL:
            out.append(FULL[p])
        else:
            raise ValueError(f"标注表出现未映射取值：{raw!r} (片段 {p!r})")
    return "×".join(out)


def norm_existing_pov(raw: str) -> str:
    """已有 POV: 字段 → 全名口径（保留 独占／共享 语义）。"""
    v = raw.strip().strip('"').strip()
    if v in ("零POV共享场景", "共享场景/零POV", "共享场景／零POV"):
        return SHARED
    exclusive = v.endswith("独占")
    if exclusive:
        v = v[:-2].strip()
    v = FULL.get(v, v)
    return f"{v}·独占" if exclusive else v


def parse_table() -> dict[int, str]:
    rows: dict[int, str] = {}
    for line in TABLE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*(\d{1,3})\s*\|\s*([^|]+?)\s*\|", line)
        if not m:
            continue
        n = int(m.group(1))
        if 1 <= n <= 150:
            rows[n] = norm_main_pov(m.group(2))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not (args.apply or args.dry_run):
        ap.error("请指定 --dry-run 或 --apply")

    table = parse_table()
    if len(table) != 150:
        print(f"FAIL 标注表只解析到 {len(table)} 行，应为 150", file=sys.stderr)
        return 1

    log: list[str] = []
    added = normalized = skipped = 0

    for path in sorted(SCENE_DIR.glob("场景*.yaml")):
        n = cn_to_int(path.stem)
        if n not in table:
            log.append(f"WARN 无标注表对应：{path.name} -> {n}")
            continue
        text = path.read_text(encoding="utf-8")
        lines = text.split("\n")
        main_val = table[n]

        # 已有 主场POV 则跳过（幂等）
        has_main = any(re.match(r"^主场POV\s*:", ln) for ln in lines)

        pov_idx = next((i for i, ln in enumerate(lines) if re.match(r"^POV\s*:", ln)), None)
        chars_idx = next((i for i, ln in enumerate(lines) if re.match(r"^人物\s*:", ln)), None)

        # 1) 规范化已有 POV:
        if pov_idx is not None:
            m = re.match(r"^POV\s*:\s*(.+?)\s*$", lines[pov_idx])
            if m:
                new_pov = norm_existing_pov(m.group(1))
                old_disp = m.group(1).strip().strip('"')
                if new_pov != old_disp:
                    lines[pov_idx] = f'POV: "{new_pov}"'
                    normalized += 1
                    log.append(f'  {n:>3} POV: "{old_disp}" -> "{new_pov}"')

        # 2) 插入 主场POV:
        if has_main:
            skipped += 1
        else:
            anchor = pov_idx if pov_idx is not None else chars_idx
            if anchor is None:
                log.append(f"WARN 找不到插入锚点（无 POV: 也无 人物:）：{path.name}")
                continue
            lines.insert(anchor + 1, f'主场POV: "{main_val}"')
            added += 1

        new_text = "\n".join(lines)
        if new_text != text and args.apply:
            path.write_text(new_text, encoding="utf-8")

    head = [
        f"mode        = {'APPLY' if args.apply else 'DRY-RUN'}",
        f"主场POV 新增 = {added}",
        f"POV 规范化    = {normalized}",
        f"主场POV 已存在 = {skipped}",
        "",
        "--- 明细 ---",
    ]
    REPORT.write_text("\n".join(head + log) + "\n", encoding="utf-8")
    print(f"{'APPLY' if args.apply else 'DRY-RUN'}: added={added} normalized={normalized} skipped={skipped}")
    print(f"report -> {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
