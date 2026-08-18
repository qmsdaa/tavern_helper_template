# -*- coding: utf-8 -*-
"""生成状态栏「移动端 412×915 实测」用的临时测量页。

产物写进 dist 状态栏目录（_harness_host.html / _harness_modal.html），
供本地 http.server + Chrome 移动端模拟做端到端量测；量完即删，不入卡。

_harness_modal.html = 真实 dist index.html + 生产挂载器的桥接（<style> 段落逐字照抄
`脚本/状态栏挂载.template.js` 的 buildBridge 尾部，含 overflow:hidden——正是"超出即被裁掉"
的那条声明）+ __counterfeitModalChar，故 fill 模式高度整链与线上一致。
_harness_host.html = 生产遮罩 CSS 与 syncOverlaySize() 的等价副本；支持 ?vvh= 模拟
visualViewport 可见高（地址栏/软键盘占位），?nojs=1 关掉 JS 定尺寸以观察纯 CSS 兜底。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# build_tools → Counterfeit → cards → 项目根（webpack 构建树在项目根，不在 cards/ 下）
ROOT = Path(__file__).resolve().parents[3]
DIST = ROOT / "tavern_helper_template" / "dist" / "Counterfeit" / "界面" / "状态栏"
TEMPLATE = ROOT / "cards" / "Counterfeit" / "脚本" / "状态栏挂载.template.js"

# 生产桥接里的样式块：从模板抽取，避免手抄漂移
BRIDGE_STYLE_RE = re.compile(r"<style>\s*(html, body \{[^}]*\})\s*</style>", re.S)

MODAL_CHAR = "比企谷八幡"  # longData 里 commitment=恋人 且 intimate_memory 非空者


def bridge_style() -> str:
    src = TEMPLATE.read_text(encoding="utf-8")
    match = BRIDGE_STYLE_RE.search(src)
    if not match:
        raise SystemExit("未能在挂载模板中定位桥接样式块，模板结构已变，请同步本脚本")
    return match.group(1)


def build_modal(dist_html: str, style_rule: str) -> str:
    # 角色可由 ?who= 覆盖（默认 MODAL_CHAR），用于逐个角色核对基础信息/攻略指南取值
    bridge = (
        "<script>\n"
        "window.__counterfeitModal = true;\n"
        "window.__counterfeitModalChar = new URLSearchParams(location.search).get('who')\n"
        f'  || {MODAL_CHAR!r};\n'.replace("'", '"')
        + "window.addEventListener('load', function () {\n"
        "  try { var f = window.frameElement; if (f) f.style.visibility = 'visible'; } catch (e) {}\n"
        "});\n"
        "</script>\n"
        "<style>\n" + style_rule + "\n</style>\n"
    )
    head = dist_html.index("<head>")
    return dist_html[: head + 6] + bridge + dist_html[head + 6 :]


HOST = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>状态栏移动端量测宿主</title>
<style>
  html, body { margin: 0; padding: 0; }
  /* 宿主页有足够内容可滚动，模拟真实酒馆聊天页 */
  body { min-height: 250vh; background: #2b1f28; color: #f0e6ec; font: 14px/1.7 sans-serif; }
  .filler { padding: 16px; }
  /* —— 以下两条选择器逐字照抄生产挂载器 ensureOverlayStyle() —— */
  .counterfeit-status-overlay{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(60,40,52,0.45);backdrop-filter:blur(2px);}
  .counterfeit-status-overlay>iframe{width:90%;max-width:1150px;height:86%;max-height:100%;border:none;border-radius:14px;display:block;background:#fdf7f4;box-shadow:0 12px 40px rgba(40,25,35,0.35);visibility:hidden;}
  @media (max-width:640px){.counterfeit-status-overlay>iframe{width:calc(100% - 20px);height:calc(100% - 20px);border-radius:10px;}}
</style>
</head>
<body>
<div class="filler">量测宿主页（背景内容用于验证遮罩期间禁止滚动）</div>
<script>
(function () {
  var params = new URLSearchParams(location.search);
  var FAKE_VV = Number(params.get('vvh') || 0);   // 模拟可见高度（地址栏/软键盘占位）
  var NO_JS = params.get('nojs') === '1';         // 只用 CSS 兜底，不跑 JS 定尺寸
  var topDoc = document;
  var OVERLAY_MARGIN = 20;
  var statusOverlay = null, overlayIframe = null, savedBodyOverflow = '';

  // —— visibleViewportHeight/Width 与 syncOverlaySize 为生产挂载器同逻辑副本 ——
  function visibleViewportHeight() {
    if (FAKE_VV > 0) return FAKE_VV;
    try { var vv = window.visualViewport; if (vv && vv.height > 0) return Math.round(vv.height); } catch (e) {}
    try { var c = topDoc.documentElement && topDoc.documentElement.clientHeight; if (c > 0) return c; } catch (e) {}
    try { if (window.innerHeight > 0) return window.innerHeight; } catch (e) {}
    return 0;
  }
  function visibleViewportWidth() {
    try { var vv = window.visualViewport; if (vv && vv.width > 0) return Math.round(vv.width); } catch (e) {}
    try { var c = topDoc.documentElement && topDoc.documentElement.clientWidth; if (c > 0) return c; } catch (e) {}
    try { if (window.innerWidth > 0) return window.innerWidth; } catch (e) {}
    return 0;
  }
  function syncOverlaySize() {
    if (NO_JS) return;
    if (!statusOverlay || !statusOverlay.isConnected || !overlayIframe) return;
    var height = visibleViewportHeight();
    var width = visibleViewportWidth();
    if (height <= 0 || width <= 0) return;
    var narrow = width <= 640;
    statusOverlay.style.left = '0px';
    statusOverlay.style.top = '0px';
    statusOverlay.style.width = width + 'px';
    statusOverlay.style.height = height + 'px';
    var targetWidth = narrow ? Math.max(0, width - OVERLAY_MARGIN) : Math.min(Math.round(width * 0.9), 1150);
    var targetHeight = narrow ? Math.max(0, height - OVERLAY_MARGIN) : Math.round(height * 0.86);
    overlayIframe.style.position = 'absolute';
    overlayIframe.style.left = Math.max(0, Math.round((width - targetWidth) / 2)) + 'px';
    overlayIframe.style.top = Math.max(0, Math.round((height - targetHeight) / 2)) + 'px';
    overlayIframe.style.width = targetWidth + 'px';
    overlayIframe.style.height = targetHeight + 'px';
    overlayIframe.style.maxHeight = Math.max(0, height - (narrow ? OVERLAY_MARGIN : 0)) + 'px';
  }

  window.__harnessVisible = function () {
    return { height: visibleViewportHeight(), width: visibleViewportWidth() };
  };
  window.__harnessOpen = function (mock) {
    var overlay = topDoc.createElement('div');
    overlay.id = 'counterfeit-status-overlay';
    overlay.className = 'counterfeit-status-overlay';
    var iframe = topDoc.createElement('iframe');
    iframe.className = 'counterfeit-statusbar-iframe-modal';
    iframe.setAttribute('frameborder', '0');
    overlay.appendChild(iframe);
    topDoc.body.appendChild(overlay);
    statusOverlay = overlay; overlayIframe = iframe;
    savedBodyOverflow = topDoc.body.style.overflow;
    topDoc.body.style.overflow = 'hidden';
    syncOverlaySize();
    window.addEventListener('resize', syncOverlaySize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncOverlaySize);
      window.visualViewport.addEventListener('scroll', syncOverlaySize);
    }
    iframe.src = '_harness_modal.html?mock=' + (mock || 'long');
    return true;
  };
  window.__harnessSetVisibleHeight = function (h) { FAKE_VV = Number(h) || 0; syncOverlaySize(); return FAKE_VV; };
})();
</script>
</body>
</html>
"""


def main() -> int:
    dist_index = DIST / "index.html"
    if not dist_index.exists():
        raise SystemExit(f"dist 未构建：{dist_index}")
    html = dist_index.read_text(encoding="utf-8")
    if '<div id="app"></div>' not in html:
        raise SystemExit("dist index.html 结构异常（缺少 #app）")
    style_rule = bridge_style()
    (DIST / "_harness_modal.html").write_text(build_modal(html, style_rule), encoding="utf-8")
    (DIST / "_harness_host.html").write_text(HOST, encoding="utf-8")
    print("harness_dir", DIST)
    print("bridge_style", style_rule)
    return 0


if __name__ == "__main__":
    sys.exit(main())
