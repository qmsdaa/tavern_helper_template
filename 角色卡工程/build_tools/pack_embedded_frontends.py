# -*- coding: utf-8 -*-
"""Embed the reviewed opening/status-bar HTML snapshots into card-local loader scripts."""

from __future__ import annotations

import hashlib
import json
import base64
import re
import subprocess
from pathlib import Path


CARD_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = CARD_ROOT.parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "tavern_helper_template"

OPENING_REF = "1d7e4d9"
STATUSBAR_REF = "HEAD"
OPENING_DIST = "dist/Counterfeit/界面/开场白/index.html"
STATUSBAR_DIST = "dist/Counterfeit/界面/状态栏/index.html"

# 临时：打包时读 working tree 的 dist 而非 git blob，便于把未提交的 store.ts 改动一起打进测试包
# 须在打了 `pnpm build:dev` 后再跑此脚本
USE_WORKING_TREE = True


def read_git_blob(ref: str, path: str) -> str:
    object_spec = f"{ref}:{path}".encode("utf-8") + b"\n"
    result = subprocess.run(
        ["git", "-c", "safe.directory=*", "cat-file", "--batch"],
        cwd=FRONTEND_ROOT,
        check=True,
        input=object_spec,
        capture_output=True,
    )
    header, payload = result.stdout.split(b"\n", 1)
    parts = header.split()
    if len(parts) != 3 or parts[1] != b"blob":
        raise RuntimeError(f"git object lookup failed: {header.decode('utf-8', 'replace')}")
    size = int(parts[2])
    blob = payload[:size]
    if len(blob) != size:
        raise RuntimeError(f"git blob truncated: expected {size}, got {len(blob)}")
    return blob.decode("utf-8")


def read_dist_html(dist_rel: str) -> str:
    abs_path = FRONTEND_ROOT / dist_rel
    if not abs_path.is_file():
        raise RuntimeError(f"working-tree dist not found: {abs_path}")
    return abs_path.read_text(encoding="utf-8")


def load_dist(ref: str, dist_rel: str) -> str:
    return read_dist_html(dist_rel) if USE_WORKING_TREE else read_git_blob(ref, dist_rel)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def html_base64(html: str) -> str:
    """Return an ASCII-only payload safe inside Tavern's outer script tag."""
    encoded = base64.b64encode(html.encode("utf-8")).decode("ascii")
    decoded = base64.b64decode(encoded).decode("utf-8")
    if decoded != html:
        raise RuntimeError("embedded HTML base64 round-trip failed")
    return encoded


def embedded_html_declaration(html: str) -> str:
    encoded = html_base64(html)
    return (
        f"  const EMBEDDED_HTML_B64 = '{encoded}';\n"
        "  const EMBEDDED_HTML = new TextDecoder().decode(\n"
        "    Uint8Array.from(atob(EMBEDDED_HTML_B64), char => char.charCodeAt(0)),\n"
        "  );"
    )


def embed_opening(html: str) -> str:
    template_path = CARD_ROOT / "脚本" / "开场白挂载.template.js"
    output_path = CARD_ROOT / "脚本" / "开场白挂载.js"
    script = template_path.read_text(encoding="utf-8")
    script = re.sub(
        r"  const CDN_URL = '[^']+';",
        lambda _match: embedded_html_declaration(html),
        script,
        count=1,
    )
    old_fetch = """    let html;
    try {
      const res = await fetch(CDN_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      html = await res.text();
    } catch (error) {
      console.error('[Counterfeit·开场白] dist 拉取失败：', error);
      if (!noticeDismissed) renderFallbackNotice('script');
      return;
    }"""
    script = replace_once(script, old_fetch, "    const html = EMBEDDED_HTML;", "opening fetch block")
    if "CDN_URL" in script or "fetch(CDN_URL)" in script:
        raise RuntimeError("opening: runtime CDN fetch remains")
    output_path.write_text(script, encoding="utf-8", newline="\n")
    return script


def embed_statusbar(html: str) -> str:
    template_path = CARD_ROOT / "脚本" / "状态栏挂载.template.js"
    output_path = CARD_ROOT / "脚本" / "状态栏挂载.js"
    script = template_path.read_text(encoding="utf-8")
    script = re.sub(
        r"  const CDN_URL = '[^']+';",
        lambda _match: embedded_html_declaration(html),
        script,
        count=1,
    )
    fetch_helper = re.compile(
        r"\n  // dist 单文件只拉取一次；失败时 30 秒后允许重试\n"
        r"  let distHtmlPromise = null;\n"
        r"  function fetchDistHtml\(\) \{[\s\S]*?\n  \}\n",
        re.MULTILINE,
    )
    script, count = fetch_helper.subn("\n", script, count=1)
    if count != 1:
        raise RuntimeError(f"statusbar fetch helper: expected one match, found {count}")
    old_fetch = """    let html;
    try {
      html = await fetchDistHtml();
    } catch (error) {
      container.remove();
      return;
    }"""
    script = replace_once(script, old_fetch, "    const html = EMBEDDED_HTML;", "statusbar fetch block")
    script = replace_once(
        script,
        "typeof EMBEDDED_HTML !== 'undefined' ? EMBEDDED_HTML : fetchDistHtml()",
        "EMBEDDED_HTML",
        "statusbar modal html source",
    )
    if "CDN_URL" in script or "fetchDistHtml" in script:
        raise RuntimeError("statusbar: runtime CDN fetch remains")
    output_path.write_text(script, encoding="utf-8", newline="\n")
    return script


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest().upper()


def main() -> None:
    opening_html = load_dist(OPENING_REF, OPENING_DIST)
    statusbar_html = load_dist(STATUSBAR_REF, STATUSBAR_DIST)

    opening_has_remote_execution = bool(
        re.search(r'<script\b[^>]*\bsrc=["\']https?://', opening_html, re.IGNORECASE)
        or re.search(r'\bfrom\s*["\']https?://', opening_html)
        or re.search(r'\bimport\s*\(\s*["\']https?://', opening_html)
    )
    if (
        '<div id="app"></div>' not in opening_html
        or ".mount('#app')" not in opening_html
        or "新的游戏" not in opening_html
        or opening_has_remote_execution
    ):
        raise RuntimeError("opening snapshot failed structural checks")
    if '<div id="app"></div>' not in statusbar_html or "latest_user_memory" not in statusbar_html:
        raise RuntimeError("statusbar snapshot failed structural checks")

    opening_script = embed_opening(opening_html)
    statusbar_script = embed_statusbar(statusbar_html)

    print(
        json.dumps(
            {
                "opening_ref": OPENING_REF,
                "opening_html_bytes": len(opening_html.encode("utf-8")),
                "opening_script_bytes": len(opening_script.encode("utf-8")),
                "opening_script_sha256": digest(opening_script),
                "statusbar_ref": STATUSBAR_REF,
                "statusbar_html_bytes": len(statusbar_html.encode("utf-8")),
                "statusbar_script_bytes": len(statusbar_script.encode("utf-8")),
                "statusbar_script_sha256": digest(statusbar_script),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
