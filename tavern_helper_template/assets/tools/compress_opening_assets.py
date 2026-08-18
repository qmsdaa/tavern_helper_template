# -*- coding: utf-8 -*-
"""压缩开场白界面素材：立绘 webp + film strip 帧 + BGM。一次性工具。"""
import os
import subprocess
import sys

from PIL import Image

ROOT = r"D:/由我们所书/我的青春恋爱物语果然有问题 Counterfeit"
SRC = os.path.join(ROOT, "图片素材", "角色立绘")
OUT = os.path.join(ROOT, "tavern_helper_template", "assets", "Counterfeit", "开场白")
os.makedirs(OUT, exist_ok=True)

PORTRAITS = {
    "hachiman": ("比企谷八幡", "比企谷八幡立绘.png"),
    "yukino": ("雪之下雪乃", "雪之下雪乃立绘.png"),
    "yui": ("由比滨结衣", "由比滨结衣立绘.png"),
    "laff": ("拉芙希妮", "拉芙希妮立绘.png"),
    "laff_smile": ("拉芙希妮", "拉芙希妮微笑.png"),
}

# 开场白封面（素材/ 目录下的新图，MAX咖啡+双丝带）
COVER = ("素材", "11b6f696-c3d9-4a69-9b73-5b65290480d6.png")

def load(folder, name):
    p = os.path.join(SRC, folder, name)
    return Image.open(p).convert("RGBA")

def save_webp(img, name, max_w, q=82):
    if img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, "WEBP", quality=q)
    print(f"{name}: {img.size} {os.path.getsize(path)//1024}KB")

# 1) 立绘（限宽 800）
imgs = {}
for key, (folder, name) in PORTRAITS.items():
    imgs[key] = load(folder, name)
    save_webp(imgs[key], f"{key}.webp", 800)

# 结衣原图四边有深色边框，裁掉 4% 边缘后重出立绘与 film 帧
def crop_border(img, ratio=0.04):
    w, h = img.size
    dx, dy = round(w * ratio), round(h * ratio)
    return img.crop((dx, dy, w - dx, h - dy))

imgs["yui"] = crop_border(imgs["yui"])
save_webp(imgs["yui"], "yui.webp", 800)

# 2) film strip 帧（16:9 上本身裁切，640x360）
def frame(img):
    w, h = img.size
    fw = w
    fh = round(w * 9 / 16)
    top = max(0, round(h * 0.02))
    if top + fh > h:
        fh = h - top
        fw = round(fh * 16 / 9)
    left = (w - fw) // 2
    return img.crop((left, top, left + fw, top + fh))

for key in ["hachiman", "yukino", "yui", "laff", "laff_smile"]:
    save_webp(frame(imgs[key]), f"film_{key}.webp", 640, q=78)

# 封面图（限宽 1200，方图）
cover = load(*COVER)
save_webp(cover, "cover.webp", 1200, q=85)

# 3) BGM → 128k mp3
import imageio_ffmpeg
ff = imageio_ffmpeg.get_ffmpeg_exe()
bgm_src = os.path.join(SRC, "音乐解码", "やなぎなぎ - ユキトキ.mp3")
bgm_out = os.path.join(OUT, "bgm_yukitoki.mp3")
subprocess.run([ff, "-y", "-i", bgm_src, "-b:a", "128k", bgm_out], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(f"bgm_yukitoki.mp3: {os.path.getsize(bgm_out)//1024}KB")
