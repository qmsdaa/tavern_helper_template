# -*- coding: utf-8 -*-
"""Counterfeit 剧情CG → CDN 管线。

功能：
  1. 扫描 图片素材/CG/场景N.png 终稿，压缩为 webp（限宽1600·q80）到 assets/Counterfeit/CG/
  2. 从 剧本日历.yaml 抓场景日期、从场景yaml抓场景功能首条作标题
  3. 生成 cg-map.json（--base 指定 jsdelivr 固定提交基址；缺省保留占位符待推送后回填）

用法：
  python assets/tools/build_cg_cdn.py                 # 压缩+生成占位地图
  python assets/tools/build_cg_cdn.py --base URL      # 只重写地图的 base
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

ALL_SCENES = [11, 21, 24, 44, 57, 67, 68, 70, 76, 85, 88, 90, 96, 99, 100, 105, 117, 122, 124, 125, 132, 143, 148, 150]
COND = {122: "laff"}
NOTE = {150: "公共线终点·分支变体待做", 105: "待绘制", 143: "待绘制", 148: "待绘制"}

CN_NUM = {}
def _cn(n):
    if n <= 10:
        return "零一二三四五六七八九十"[n] if n < 10 else "十"
    if n < 20:
        return "十" + "零一二三四五六七八九"[n - 10]
    if n < 100:
        t, o = divmod(n, 10)
        s = "一二三四五六七八九"[t - 1] + "十"
        return s + ("零一二三四五六七八九"[o - 1] if o else "")
    h, r = divmod(n, 100)
    s = "一百"
    if r == 0:
        return s
    if r < 10:
        return s + "零" + "一二三四五六七八九"[r - 1]
    return s + _cn(r)

def scene_file(n):
    return os.path.join(SCENE_DIR, f"场景{_cn(n)}.yaml")

def parse_dates():
    dates = {}
    for m in re.finditer(r"(\d{1,3}):(\d{4}/\d{1,2}/\d{1,2})", open(CALENDAR, encoding="utf-8").read()):
        dates[int(m.group(1))] = m.group(2).replace("/", "-")
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

def compress(n):
    src = os.path.join(SRC, f"场景{n}.png")
    if not os.path.isfile(src):
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
            print(f"场景{n}: {size//1024}KB")
        else:
            pending += 1
        scenes[str(n)] = {
            "file": file_name,
            "cond": COND.get(n),
            "date": dates.get(n, ""),
            "title": parse_title(n),
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
