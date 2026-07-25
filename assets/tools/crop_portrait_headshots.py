# -*- coding: utf-8 -*-
"""四主角立绘头像裁切（2026-07-25）：全身立绘 → 头+肩 4:5 头像，替换 POV 卡用 webp。

裁切框：y 从 0 起（保住呆毛/头顶），高 = h_rel × 图高，宽 = 高 × 0.8，水平以 cx_rel 为中心。
结衣原图四边有深色边框，先裁 4% 边缘（沿用 compress_opening_assets.py 的处理）。
"""
import os

from PIL import Image

ROOT = r"D:/由我们所书/我的青春恋爱物语果然有问题 Counterfeit"
SRC = os.path.join(ROOT, "图片素材", "角色立绘")
OUT = os.path.join(ROOT, "tavern_helper_template", "assets", "Counterfeit", "开场白")

ASPECT = 0.8  # 宽/高 = 4:5
MAX_W = 640

# (源相对路径, 输出名, 头中心x比例, 裁切高度比例, 是否先裁4%边框)
JOBS = [
    ("比企谷八幡/比企谷八幡立绘.png", "hachiman.webp", 0.52, 0.33, False),
    ("雪之下雪乃/雪之下雪乃立绘.png", "yukino.webp", 0.50, 0.32, False),
    ("由比滨结衣/由比滨结衣立绘.png", "yui.webp", 0.50, 0.34, True),
    ("拉芙希妮/拉芙希妮立绘.png", "laff.webp", 0.50, 0.32, False),
    ("拉芙希妮/拉芙希妮微笑.png", "laff_smile.webp", 0.50, 0.32, False),
]


def crop_border(img, ratio=0.04):
    w, h = img.size
    dx, dy = round(w * ratio), round(h * ratio)
    return img.crop((dx, dy, w - dx, h - dy))


for src_rel, out_name, cx_rel, h_rel, border in JOBS:
    img = Image.open(os.path.join(SRC, src_rel)).convert("RGBA")
    if border:
        img = crop_border(img)
    w, h = img.size
    ch = round(h * h_rel)
    cw = round(ch * ASPECT)
    x0 = max(0, min(round(cx_rel * w) - cw // 2, w - cw))
    head = img.crop((x0, 0, x0 + cw, ch))
    if head.width > MAX_W:
        head = head.resize((MAX_W, round(head.height * MAX_W / head.width)), Image.LANCZOS)
    dst = os.path.join(OUT, out_name)
    head.save(dst, "WEBP", quality=82)
    print(f"{out_name}: 裁切框=({x0},0,{x0 + cw},{ch}) 输出={head.size} {os.path.getsize(dst) // 1024}KB")
