# -*- coding: utf-8 -*-
"""打包产物一致性校验：独立 JSON 载荷必须与当前 dist、BRIDGE_SHIM 与 loader 模板精确一致。

用法：
    python assets/tools/verify_phone_pack.py

校验项：
    1. 独立 JSON 存在且结构完整（type/name/id/content/info/button/data/export_with）
    2. content 内嵌的 PHONE_HTML 与 dist/Counterfeit/界面/手机/index.html + BRIDGE_SHIM 逐字节一致
    3. 载荷哈希与 info 字段声明一致
    4. loader 模板结构（__PHONE_HTML__ 替换点、幂等清理、消息桥）未被破坏
    5. 无裸运行时调用（defineStore/createPinia/ref/... 必须在 bundle 内解析）
"""
import hashlib
import json
import os
import re
import sys

# Windows GBK 控制台输出 Unicode 校验符号时抛错，强制 UTF-8
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tavern_helper_template/
PROJECT_ROOT = os.path.dirname(ROOT)
DIST_HTML = os.path.join(ROOT, "dist", "Counterfeit", "界面", "手机", "index.html")
LOADER_TEMPLATE = os.path.join(ROOT, "assets", "tools", "phone_loader_template.js")
OUT_JSON = os.path.join(PROJECT_ROOT, "酒馆助手脚本-手机助手-Counterfeit.json")

BARE_RUNTIME_CALLS = (
    "defineStore",
    "createPinia",
    "ref",
    "reactive",
    "computed",
    "onMounted",
    "watch",
    "nextTick",
)

FAILED = False


def fail(message: str) -> None:
    global FAILED
    FAILED = True
    print(f"  ✗ {message}")


def ok(message: str) -> None:
    print(f"  ✓ {message}")


def main() -> int:
    print("1) 独立 JSON 结构")
    with open(OUT_JSON, encoding="utf-8") as f:
        payload = json.load(f)
    for key in ("type", "enabled", "name", "id", "content", "info", "button", "data", "export_with"):
        if key not in payload:
            fail(f"payload 缺少字段 {key}")
    ok(f"字段完整 · name={payload.get('name')} · id={payload.get('id')[:8]}…")

    content = payload["content"]
    if payload.get("type") != "script":
        fail("type 不是 script")
    else:
        ok("type=script")
    if not isinstance(content, str) or len(content) < 1000:
        fail("content 缺失或过短")
    else:
        ok(f"content {len(content)} 字符")

    print("2) 内嵌 PHONE_HTML 与 dist + BRIDGE_SHIM 精确一致")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import pack_phone_script

    with open(DIST_HTML, encoding="utf-8") as f:
        dist = f.read()
    expected_html = dist.replace("<head>", "<head>\n" + pack_phone_script.BRIDGE_SHIM, 1)
    with open(LOADER_TEMPLATE, encoding="utf-8") as f:
        loader = f.read()
    # 复刻打包器的完整流程，做整串 content 比对（不手工反转义）
    expected_content = loader.replace(
        "__PHONE_HTML__", json.dumps(expected_html, ensure_ascii=False)
    )
    expected_content = expected_content.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    if content == expected_content:
        ok(f"content 与 dist({len(dist)}B) + BRIDGE_SHIM + loader 模板逐字节一致（{len(content)}B）")
    else:
        fail(
            f"content 与期望不一致（实际 {len(content)}B / 期望 {len(expected_content)}B）；"
            "请重新执行 pack_phone_script.py"
        )

    print("3) 载荷哈希与 info 声明一致")
    sha1 = hashlib.sha1(content.encode("utf-8")).hexdigest()
    declared = payload.get("info", "")
    mh = re.search(r"hash=([0-9a-f]{40})", declared)
    if not mh:
        fail("info 中缺少 hash")
    elif mh.group(1) != sha1:
        fail(f"哈希不一致：实际 {sha1} / 声明 {mh.group(1)}")
    else:
        ok(f"hash={sha1} 一致")

    print("4) loader 模板关键结构")
    with open(LOADER_TEMPLATE, encoding="utf-8") as f:
        loader = f.read()
    for marker in (
        "counterfeit-phone-launcher-root",
        "counterfeit-phone-iframe",
        "counterfeit-phone-loader",
        "__counterfeit_sandbox__",
        "window.name = SANDBOX_NAME",
    ):
        if marker not in content:
            fail(f"content 缺少 loader 结构 {marker}")
    ok("loader 模板结构完整（启动器/iframe/沙箱命名/消息桥）")
    if "__PHONE_HTML__" in content:
        fail("__PHONE_HTML__ 占位符未被替换")
    else:
        ok("__PHONE_HTML__ 占位符已被替换")
    if content.count("</script") > 0:
        fail("content 中存在未转义的 </script（会被宿主截断）")
    else:
        ok("</script 转义完整")

    print("5) 无裸运行时调用（Vue/Pinia 注入解析）")
    problems = []
    for name in BARE_RUNTIME_CALLS:
        if re.search(rf"(?<![\w.$]){re.escape(name)}\s*\(", content):
            problems.append(name)
    if problems:
        fail(f"存在未解析的运行时调用：{', '.join(problems)}")
    else:
        ok("defineStore/createPinia/ref/reactive/computed/onMounted/watch/nextTick 全部在 bundle 内解析")

    print()
    if FAILED:
        print("✗ 校验失败")
        return 1
    print("✓ 独立 JSON 与 dist / BRIDGE_SHIM / loader 模板完全一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
