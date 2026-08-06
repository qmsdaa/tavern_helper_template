# -*- coding: utf-8 -*-
"""Counterfeit 剧情CG → CDN 管线。

功能：
  1. 扫描 图片素材/CG/ 终稿（场景N.png 或「CG NN · 场景N.png」「场景N · 标题.png」等命名），
     压缩为 webp（限宽1600·q80）到 assets/Counterfeit/CG/
  2. 从 剧本日历.yaml 抓场景日期（支持幕块年份）、从场景yaml抓场景功能首条作标题
  3. 生成 cg-map.json（--base 指定 jsdelivr 固定提交基址；缺省保留旧 base）

用法：
  python assets/tools/build_cg_cdn.py                 # 压缩+生成地图（沿用旧 base）
  python assets/tools/build_cg_cdn.py --base URL      # 只重写地图的 base（推送后回填）
"""
import argparse
import json
import os
import re
from datetime import datetime, timezone

from PIL import Image

ROOT = r"D:/由我们所书/我的青春恋爱物语果然有问题 Counterfeit"
SRC = os.path.join(ROOT, "图片素材", "CG")
CARD = os.path.join(ROOT, "cards", "Counterfeit")
CALENDAR = os.path.join(CARD, "世界书", "时间线", "剧本日历.yaml")
SCENE_DIR = os.path.join(CARD, "世界书", "事件")
OUT = os.path.join(ROOT, "tavern_helper_template", "assets", "Counterfeit", "CG")
MAP_PATH = os.path.join(OUT, "cg-map.json")

# 已绘制场景（2026-08-06 扩充至 38 张：幕间批次 9 张 + 结衣主场 4 张 + 原有 24 张 - 场景125 待绘制）
ALL_SCENES = [
    9, 10, 11, 21, 24, 25, 44, 57, 61, 67, 68, 70, 75, 76, 77, 85, 88, 90, 92,
    96, 98, 99, 100, 105, 117, 119, 122, 124, 126, 132, 133, 139, 140, 143, 145, 148, 150,
]
# 幕间 CG 的源文件不带场景号（「CG NN · 第X幕→第Y幕（…）.png」），按 AGENTS.md B1 映射挂场景
INTERLUDE_MAP = {
    61: "CG 03", 77: "CG 04", 92: "CG 05",
    98: "CG 06", 119: "CG 07", 126: "CG 08", 133: "CG 09",
}
COND = {122: "laff"}
NOTE = {150: "公共线终点·分支变体待做"}
# 自动抓取不佳的标题人工精修（场景功能首条含 HAMMER 标识/前缀，读起来不像标题）
TITLE_OVERRIDE = {
    57: "高糖红茶的腹黑反击",
    96: "雷雨夜的越洋电话",
    100: "拉芙希妮首展三件旧物",
    124: "深夜书房对峙",
}

CN_NUM = {}
def _cn(n):
    if n <= 10:
        return "零一二三四五六七八九十"[n] if n < 10 else "十"
    if n < 20:
        return "十" + "一二三四五六七八九"[n - 11]
    if n < 100:
        t, o = divmod(n, 10)
        s = "一二三四五六七八九"[t - 1] + "十"
        return s + ("一二三四五六七八九"[o - 1] if o else "")
    h, r = divmod(n, 100)
    s = "一二三四五六七八九"[h - 1] + "百"
    if r == 0:
        return s
    if r < 10:
        return s + "零" + "一二三四五六七八九"[r - 1]
    if r < 20:
        # 百位余数 10-19 写作「一百一十」「一百一十七」而非「一百十七」
        return s + "一十" + ("一二三四五六七八九"[r - 11] if r > 10 else "")
    return s + _cn(r)

def scene_file(n):
    return os.path.join(SCENE_DIR, f"场景{_cn(n)}.yaml")

def parse_dates():
    """解析剧本日历：按幕块年份匹配「场景(区间):月/日」，产出 场景号 → YYYY-M-D。
    日历为 EJS 模板（<%- 行需跳过），年份挂在幕块标题「第X幕（YYYY）」上。"""
    dates = {}
    text = open(CALENDAR, encoding="utf-8").read()
    current_year = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("<%") or ":" not in line:
            if "（" in line and "）" in line:
                ym = re.search(r"（(\d{4})）", line)
                if ym and "幕" in line:
                    current_year = int(ym.group(1))
            continue
        if re.search(r"（(\d{4})）", line) and "幕" in line:
            ym = re.search(r"（(\d{4})）", line)
            current_year = int(ym.group(1))
        for m in re.finditer(r"(\d{1,3})(?:-(\d{1,3}))?:(\d{1,2})/(\d{1,2})", line):
            start, end, month, day = int(m.group(1)), m.group(2), int(m.group(3)), int(m.group(4))
            end = int(end) if end else start
            year = current_year or datetime.now().year
            iso = f"{year}-{month:02d}-{day:02d}"
            for n in range(start, end + 1):
                dates[n] = iso
    return dates

def parse_title(n):
    p = scene_file(n)
    if not os.path.isfile(p):
        return ""
    text = open(p, encoding="utf-8").read()
    m = re.search(r"场景功能:\s*\n\s*-\s*(.+)", text)
    if not m:
        return ""
    t = re.sub(r"[🧸🍵⛈️🔥★☆#0-9a-zA-Z]", "", m.group(1))
    t = re.split(r"（|：", t)[0].strip()
    return t[:16]

def find_source(n):
    """在 图片素材/CG/ 里按场景号定位源图。
    兼容「场景N.png」「CG 01 · 场景10.png」「场景139 · 第十幕….png」与幕间「CG 03 · 第X幕→第Y幕（…）.png」。"""
    pattern = re.compile(rf"场景{n}(?!\d)")
    for name in os.listdir(SRC):
        if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and pattern.search(name):
            return os.path.join(SRC, name)
    prefix = INTERLUDE_MAP.get(n)
    if prefix:
        for name in os.listdir(SRC):
            if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and name.startswith(prefix):
                return os.path.join(SRC, name)
    return None

def compress(n):
    src = find_source(n)
    if not src:
        return None, 0
    img = Image.open(src).convert("RGB")
    if img.width > 1600:
        img = img.resize((1600, round(img.height * 1600 / img.width)), Image.LANCZOS)
    out = os.path.join(OUT, f"场景{n}.webp")
    img.save(out, "WEBP", quality=80)
    return f"场景{n}.webp", os.path.getsize(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=None)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    old_map = {}
    if os.path.isfile(MAP_PATH):
        old_map = json.load(open(MAP_PATH, encoding="utf-8"))
    base = args.base or old_map.get("images_base") or "__IMAGES_BASE__"

    dates = parse_dates()
    scenes = {}
    done = pending = 0
    for n in ALL_SCENES:
        if args.base and os.path.isfile(os.path.join(OUT, f"场景{n}.webp")):
            file_name, size = f"场景{n}.webp", os.path.getsize(os.path.join(OUT, f"场景{n}.webp"))
        else:
            file_name, size = compress(n)
        if file_name:
            done += 1
            print(f"场景{n}: {size // 1024}KB")
        else:
            pending += 1
        scenes[str(n)] = {
            "file": file_name,
            "cond": COND.get(n),
            "date": dates.get(n, ""),
            "title": TITLE_OVERRIDE.get(n, parse_title(n)),
        }
        if not file_name:
            scenes[str(n)]["note"] = NOTE.get(n, "待绘制")
        elif n in NOTE:
            scenes[str(n)]["note"] = NOTE[n]

    payload = {
        "version": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "images_base": base,
        "scenes": scenes,
    }
    json.dump(payload, open(MAP_PATH, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, indent=2)
    print(f"\n地图: {MAP_PATH} · 已就绪{done}张 / 待绘制{pending}张 · base={base}")

if __name__ == "__main__":
    main()
