# -*- coding: utf-8 -*-
"""把 角色卡工程/脚本/对话渲染.js 打包成可导入的酒馆助手脚本 JSON，
并生成一个本地预览页（真实跑脚本里的 DOM 渲染路径）。

用法（在 角色卡工程/build_tools/ 或任意目录跑）：
    python build_tools/pack_dialogue_script.py

产物：
    独立产物/酒馆助手脚本-对话渲染-Counterfeit.json
    独立产物/对话渲染-预览.html
"""
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CARD_ROOT = os.path.dirname(HERE)                       # 角色卡工程/
PROJECT_ROOT = os.path.dirname(CARD_ROOT)               # Counterfeit-v0.6.0-完整工程-hotfix2/
SOURCE_JS = os.path.join(CARD_ROOT, "脚本", "对话渲染.js")
STATE_JSON = os.path.join(CARD_ROOT, "tavern-cards-state.json")
OUT_JSON = os.path.join(PROJECT_ROOT, "独立产物", "酒馆助手脚本-对话渲染-Counterfeit.json")
OUT_PREVIEW = os.path.join(PROJECT_ROOT, "独立产物", "对话渲染-预览.html")
STATE_KEY = "对话渲染-Counterfeit"

PREVIEW_SAMPLE = """<div class="mes_block"><div class="mes_text">
<p>【2013年5月20日 15:30|总武高中·奉仕部活动室|阴|例行公事的平静】</p>
<p>侍奉部的窗帘被风吹起来，雪之下把红茶杯放回杯垫，发出很轻的一声。</p>
<p>@bubble:雪之下雪乃|平静|[那么，结论呢。拖到天台锁门之前，总要有人说一句有用的话。]</p>
<p>@bubble:比企谷八幡|无奈|[*（来了，雪之下的效率话术。这时候装傻只会被追加提问。）*]</p>
<p>由比滨看看这个又看看那个，举起手。</p>
<p>@bubble:由比滨结衣|紧张|[那、那个！先从能做的开始好不好？比如……先把桌子拼起来？]</p>
<p>@bubble:材木座义辉|兴奋|[哼哼哼……汝等终于理解了吗，这正是将军出征前的阵前会议！]</p>
<p>@bubble:？？？|平静|[打扰了，请问侍奉部是在这里吗？]</p>
<p>门外的声音让三个人同时转过头去。</p>
</div></div>"""

PREVIEW_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>对话渲染预览 · Counterfeit</title>
<style>
  body{margin:0;padding:24px;background:#f3ede6;font-family:"Microsoft YaHei",sans-serif}
  body:has(#chat.cf-theme-dark){background:#161114}
  body:has(#chat.cf-theme-green){background:#e9f1e0}
  #chat{max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #efe0e3;border-radius:12px;padding:16px 20px}
  #chat.cf-theme-dark{background:#1d1719;border-color:#3a2d31;color:#e8ded9}
  #chat.cf-theme-green{background:#f6faf1;border-color:#d5e2c6;color:#43503f}
  h1{font-size:15px;color:#c05a72;text-align:center;letter-spacing:4px}
  .mes_text{color:#5b4a4f}
  #chat.cf-theme-dark .mes_text{color:#e8ded9}
  #chat.cf-theme-green .mes_text{color:#43503f}
  .mes_text p{margin:8px 0;font-size:15.5px;line-height:1.8}
  #theme-bar{display:flex;gap:10px;justify-content:center;margin:0 auto 14px;max-width:300px}
  #theme-bar button{flex:1;padding:5px 0;border:1px solid #e87a90;border-radius:8px;background:#fdf1f3;color:#c05a72;cursor:pointer}
  #theme-bar button:hover{background:#e87a90;color:#fff}
  #config-bar{display:flex;gap:12px;justify-content:center;align-items:center;margin:0 auto 16px;max-width:560px;flex-wrap:wrap;font-size:12px;color:#5b4a4f}
  #config-bar label{display:flex;align-items:center;gap:6px}
  #config-bar input[type=range]{accent-color:#e87a90;width:120px}
  #config-bar .cf-theme-btn{padding:4px 10px;border:1px solid #e87a90;border-radius:8px;background:#fdf1f3;color:#c05a72;cursor:pointer}
  #config-bar .cf-theme-btn:hover{background:#e87a90;color:#fff}
</style>
</head>
<body>
<h1>对话渲染预览（本地静态 · 真实跑渲染引擎）</h1>
<div id="config-bar">
  <button class="cf-theme-btn" data-t="parchment">羊皮纸</button>
  <button class="cf-theme-btn" data-t="dark">暗夜</button>
  <button class="cf-theme-btn" data-t="green">豆沙绿</button>
  <label>气泡字号 <input id="bubble-fs" type="range" min="12" max="22" step="0.5" value="17" /></label>
  <label>旁白字号 <input id="narrative-fs" type="range" min="12" max="22" step="0.5" value="15.5" /></label>
  <label>行距 <input id="line-height" type="range" min="1.4" max="2.0" step="0.05" value="1.75" /></label>
  <label>头像大小 <input id="avatar-size" type="range" min="36" max="72" step="2" value="48" /></label>
</div>
<div id="chat">__SAMPLE__</div>
<script>__SCRIPT__</script>
<script>
function applyPreviewConfig() {
  var chat = document.getElementById('chat');
  chat.style.setProperty('--cf-bubble-fs', document.getElementById('bubble-fs').value + 'px');
  chat.style.setProperty('--cf-narrative-fs', document.getElementById('narrative-fs').value + 'px');
  chat.style.setProperty('--cf-line-height', document.getElementById('line-height').value);
  chat.style.setProperty('--cf-avatar-size', document.getElementById('avatar-size').value + 'px');
}
['input','change'].forEach(function (evt) {
  document.getElementById('bubble-fs').addEventListener(evt, applyPreviewConfig);
  document.getElementById('narrative-fs').addEventListener(evt, applyPreviewConfig);
  document.getElementById('line-height').addEventListener(evt, applyPreviewConfig);
  document.getElementById('avatar-size').addEventListener(evt, applyPreviewConfig);
});
applyPreviewConfig();

function applyPreviewTheme(t) {
  var chat = document.getElementById('chat');
  chat.classList.remove('cf-theme-dark', 'cf-theme-green');
  if (t !== 'parchment') chat.classList.add('cf-theme-' + t);
}
document.getElementById('config-bar').addEventListener('click', function (e) {
  var t = e.target && e.target.getAttribute('data-t');
  if (!t) return;
  applyPreviewTheme(t);
  try { localStorage.setItem('cf_bubble_config_v1', JSON.stringify({ enabled: true, theme: t })); } catch (_) {}
});
</script>
</body>
</html>
"""


def main():
    with open(SOURCE_JS, encoding="utf-8") as f:
        content = f.read()
    # 酒馆助手若以 <script> 方式注入脚本，源码中的 </script 与 <!-- 会提前截断标签；
    # 本脚本不应含有这两种序列，检出即报错（人工改写法，不做静默转义）。
    for token in ("</script", "<!--"):
        if token in content:
            raise SystemExit(f"脚本源码含有危险序列 {token!r}，请改写后再打包")

    sha1 = hashlib.sha1(content.encode("utf-8")).hexdigest()
    payload = {
        "type": "script",
        "enabled": True,
        "name": "对话渲染-Counterfeit",
        "id": str(uuid.uuid4()),
        "content": content,
        "info": f"build={datetime.now(timezone.utc).isoformat()}; hash={sha1}; source=角色卡工程/脚本/对话渲染.js",
        "button": {"enabled": True, "buttons": [{"name": "对话气泡", "visible": True}]},
        "data": {},
        "export_with": {"data": True, "button": True},
    }

    # 独立脚本与卡内注册共用同一份元数据，避免源码已更新而卡内 info/id 仍指向旧构建。
    with open(STATE_JSON, encoding="utf-8") as f:
        state = json.load(f)
    scripts = state["extensions"]["tavern_helper"]["scripts"]
    entry = scripts.setdefault(
        STATE_KEY,
        {"type": "script", "script_file": "脚本/对话渲染.js"},
    )
    entry.update(
        {
            "enabled": True,
            "id": payload["id"],
            "info": payload["info"],
            "button": payload["button"],
            "data": payload["data"],
        }
    )

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    with open(STATE_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")

    preview = PREVIEW_TEMPLATE.replace("__SAMPLE__", PREVIEW_SAMPLE).replace("__SCRIPT__", content)
    with open(OUT_PREVIEW, "w", encoding="utf-8") as f:
        f.write(preview)

    print(f"已打包 {OUT_JSON}（{os.path.getsize(OUT_JSON) // 1024}KB · hash={sha1[:12]}）")
    print(f"已生成 {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
