# -*- coding: utf-8 -*-
"""手机助手脚本同步工具（D10 分离版 · 2026-08-05）。

默认行为（分离模式）：只校验项目根目录的独立安装产物
  「酒馆助手脚本-手机助手-Counterfeit.json」（由 tavern_helper_template/assets/tools/pack_phone_script.py 生成），
  不触碰角色卡。开发期手机助手独立安装/独立调试，改一次前端不再需要重打包整卡。

用法：
    python build_tools/sync_phone_artifacts.py            # 分离模式：校验独立产物（默认）
    python build_tools/sync_phone_artifacts.py --embed    # 内嵌模式：写回卡内（最终分发形态待定，预留能力）

内嵌模式会执行三项写入：
    1. cards/Counterfeit/酒馆助手脚本-手机助手-Counterfeit.json（卡内副本）
    2. cards/Counterfeit/脚本/手机助手.js（卡内脚本）
    3. tavern-cards-state.json 的 extensions.tavern_helper.scripts["手机助手-Counterfeit"] 注册
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


CARD_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = CARD_ROOT.parents[1]
SOURCE_JSON = PROJECT_ROOT / "酒馆助手脚本-手机助手-Counterfeit.json"
CARD_JSON = CARD_ROOT / "酒馆助手脚本-手机助手-Counterfeit.json"
CARD_SCRIPT = CARD_ROOT / "脚本" / "手机助手.js"
STATE_JSON = CARD_ROOT / "tavern-cards-state.json"
STATE_KEY = "手机助手-Counterfeit"

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


def assert_no_bare_runtime_calls(content: str) -> None:
    failures = []
    for name in BARE_RUNTIME_CALLS:
        if re.search(rf"(?<![\w.$]){re.escape(name)}\s*\(", content):
            failures.append(name)
    if failures:
        raise RuntimeError(f"phone bundle contains unresolved runtime calls: {', '.join(failures)}")


def load_source_payload() -> dict:
    if not SOURCE_JSON.exists():
        raise SystemExit(
            f"找不到独立安装产物：{SOURCE_JSON}\n"
            "请先构建手机前端并打包：\n"
            "  cd tavern_helper_template\n"
            "  npx webpack --config webpack.phone.config.ts --mode production\n"
            "  python assets/tools/pack_phone_script.py"
        )
    payload = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    content = payload.get("content")
    if not isinstance(content, str) or not content:
        raise RuntimeError("独立安装产物缺少 content 字段")
    return payload


def report(payload: dict, embedded: bool) -> None:
    content = payload["content"]
    print(
        json.dumps(
            {
                "mode": "embed" if embedded else "standalone",
                "source": str(SOURCE_JSON),
                "phone_id": payload.get("id", ""),
                "phone_info": payload.get("info", ""),
                "script_bytes": len(content.encode("utf-8")),
                "bare_runtime_calls": [],
                "card_embedded": embedded,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def embed(payload: dict) -> None:
    content = payload["content"]
    state = json.loads(STATE_JSON.read_text(encoding="utf-8"))
    scripts = state["extensions"]["tavern_helper"]["scripts"]
    entry = scripts.setdefault(STATE_KEY, {"type": "script", "script_file": "脚本/手机助手.js"})
    entry["enabled"] = True
    entry["id"] = payload["id"]
    entry["info"] = payload.get("info", "")
    entry["button"] = payload.get("button", {"enabled": True, "buttons": []})
    entry["data"] = payload.get("data", {})

    CARD_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    CARD_SCRIPT.write_text(
        content + ("\n" if not content.endswith("\n") else ""),
        encoding="utf-8",
        newline="\n",
    )
    STATE_JSON.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="手机助手脚本同步（D10 分离版）")
    parser.add_argument("--embed", action="store_true", help="内嵌回卡（最终分发形态待定，预留能力）")
    args = parser.parse_args()

    payload = load_source_payload()
    assert_no_bare_runtime_calls(payload["content"])

    if args.embed:
        embed(payload)
    report(payload, embedded=args.embed)


if __name__ == "__main__":
    main()
