# -*- coding: utf-8 -*-
"""新开场白素材一次性导入（2026-07-25 万花筒序奏改版）。

素材源：图片素材/新开场白/
产出：
  - 序奏 CG / 封面 / 樱花树背景 → assets/Counterfeit/开场白/*.webp
  - 新 BGM（约 100kbps 已达标）→ assets/Counterfeit/开场白/bgm.mp3
  - 旧 BGM（ユキトキ）→ 移回 图片素材/新开场白/ 备份
  - 画廊预置图 → assets/Counterfeit/开场白/画廊/（随后需跑 build_gallery.py）
"""
import os
import shutil

from PIL import Image

ROOT = r"D:/由我们所书/我的青春恋爱物语果然有问题 Counterfeit"
SRC = os.path.join(ROOT, "图片素材", "新开场白")
OUT = os.path.join(ROOT, "tavern_helper_template", "assets", "Counterfeit", "开场白")
GALLERY = os.path.join(OUT, "画廊")


def save_webp(src_name, out_name, max_w, q=82):
    img = Image.open(os.path.join(SRC, src_name)).convert("RGB")
    if img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, out_name)
    img.save(path, "WEBP", quality=q)
    print(f"{out_name}: {img.size} {os.path.getsize(path) // 1024}KB")


# 1) 万花筒序奏 CG（群像母图保留 2048 宽供推镜放大）
save_webp("cg1.png", "intro_group.webp", 2048)
save_webp("cg5.png", "intro_trauma.webp", 1672)
save_webp("cg6 .png", "intro_token.webp", 1672)  # 源文件名带空格
save_webp("cg7.png", "intro_animals.webp", 1672)
save_webp("cg8.png", "intro_selfie.webp", 1648)

# 2) 标题屏：樱花树背景 + 新封面（MAX咖啡+丝巾 方图）
save_webp("樱花树背景.png", "bg_sakura.webp", 1456, q=80)
save_webp("封面.png", "cover.webp", 1200, q=85)

# 3) BGM：新曲已是 ~100kbps 直接拷贝；旧曲移回素材目录备份
shutil.copy2(os.path.join(SRC, "新背景音乐.mp3"), os.path.join(OUT, "bgm.mp3"))
print(f"bgm.mp3: {os.path.getsize(os.path.join(OUT, 'bgm.mp3')) // 1024}KB")
old_bgm = os.path.join(OUT, "bgm_yukitoki.mp3")
if os.path.exists(old_bgm):
    shutil.move(old_bgm, os.path.join(SRC, "旧BGM_ユキトキ.mp3"))
    print("旧 BGM 已备份到 图片素材/新开场白/旧BGM_ユキトキ.mp3")

# 4) 画廊预置：群像/四小只/自拍 + 四只单独立绘（⑤⑥创伤格只进序奏不进画廊）
PRELOAD = [
    ("cg1.png", "四人同框.png"),
    ("cg7.png", "四小只.png"),
    ("cg8.png", "自拍合照.png"),
    ("八幡小刺猬.png", "刺猬八幡.png"),
    ("雪乃黑猫.png", "黑猫雪乃.png"),
    ("结衣小狗.png", "小狗结衣.png"),
    ("苇草龙泡泡.jpg", "小龙泡泡.jpg"),
]
for src_name, dst_name in PRELOAD:
    dst = os.path.join(GALLERY, dst_name)
    if not os.path.exists(dst):
        shutil.copy2(os.path.join(SRC, src_name), dst)
        print(f"画廊预置: {dst_name}")

CAPTIONS = """# ---- 新开场白预置（2026-07-25）----
四人同框=四人同框|蓝天与海之间，四个人并肩而立
四小只=四小只|刺猬、黑猫、粉毛狗与小火龙
自拍合照=第一张自拍|结衣举起了手机，把所有人都框了进去
刺猬八幡=小刺猬|MAX 咖啡是底线
黑猫雪乃=小黑猫|红丝带与独处时间
小狗结衣=小粉狗|亲近是想传达的心意
小龙泡泡=小火龙|红茶要趁热喝
"""
captions_file = os.path.join(GALLERY, "说明.txt")
with open(captions_file, encoding="utf-8") as f:
    existing = f.read()
if "四人同框=" not in existing:
    with open(captions_file, "a", encoding="utf-8", newline="\n") as f:
        f.write(CAPTIONS)
    print("说明.txt 已追加文案")

print("\n下一步：python assets/tools/build_gallery.py（生成 gallery.generated.ts）")
