# -*- coding: utf-8 -*-
"""把手机界面构建产物打包成单个可导入的酒馆助手脚本 JSON。

用法：
    python assets/tools/pack_phone_script.py

流程：
    1. 读取 dist/Counterfeit/界面/手机/index.html（需先 pnpm build）
    2. 在 <head> 后注入酒馆 API 桥（srcdoc 同源，从父窗口拷贝 getVariables 等）
    3. 把整份 HTML 嵌入加载器模板，产出项目根目录的 酒馆助手脚本-手机助手-Counterfeit.json
"""
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # tavern_helper_template/
PROJECT_ROOT = os.path.dirname(ROOT)
DIST_HTML = os.path.join(ROOT, "dist", "Counterfeit", "界面", "手机", "index.html")
LOADER_TEMPLATE = os.path.join(ROOT, "assets", "tools", "phone_loader_template.js")
OUT_JSON = os.path.join(PROJECT_ROOT, "酒馆助手脚本-手机助手-Counterfeit.json")

BRIDGE_SHIM = """<script>
(function(){
// Counterfeit API 桥：手机 iframe 的 parent 是宿主页面（没有酒馆 API），
// 真正的 API 在酒馆助手脚本沙箱里——加载器已把它命名为 __counterfeit_sandbox__。
var N=['getVariables','updateVariablesWith','insertOrAssignVariables','deleteVariable','getChatMessages','setChatMessages','getLastMessageId','generateRaw','generate','eventOn','eventMakeFirst','eventEmit','tavern_events','getCharWorldbookNames','getWorldbook','updateWorldbookWith','createWorldbook','getOrCreateChatWorldbook','getModelList','getProxyPresetNames','getPresetNames','stopGenerationById','stopAllGeneration','_','$','jQuery'];
function pick(host){
  for(var i=0;i<N.length;i++){var k=N[i];
    try{if(typeof window[k]==='undefined'&&typeof host[k]!=='undefined'){window[k]=host[k];}}catch(e){}
  }
}
try{
  var host=window.parent;
  if(!host||host===window)return;
  var sandbox=null;
  try{
    for(var i=0;i<host.frames.length;i++){
      var f=host.frames[i];
      try{if(f&&f.name==='__counterfeit_sandbox__'){sandbox=f;break;}}catch(e){}
    }
  }catch(e){}
  pick(sandbox||host);
}catch(e){}
})();
</script>"""


def main():
    with open(DIST_HTML, encoding="utf-8") as f:
        html = f.read()
    if "<head>" not in html:
        raise SystemExit("构建产物里找不到 <head>，请先 pnpm build")
    html = html.replace("<head>", "<head>\n" + BRIDGE_SHIM, 1)

    with open(LOADER_TEMPLATE, encoding="utf-8") as f:
        loader = f.read()
    if "__PHONE_HTML__" not in loader:
        raise SystemExit("加载器模板缺少 __PHONE_HTML__ 占位符")
    content = loader.replace("__PHONE_HTML__", json.dumps(html, ensure_ascii=False))
    # 关键转义：脚本内容若被酒馆助手以 <script> 标签方式执行，内嵌 HTML 里的
    # </script> 会提前截断标签（静默死亡）。JS 字符串里 <\/script> 求值后仍是 </script>。
    content = content.replace("</script", "<\\/script").replace("<!--", "<\\!--")

    sha1 = hashlib.sha1(content.encode("utf-8")).hexdigest()
    payload = {
        "type": "script",
        "enabled": True,
        "name": "手机助手-Counterfeit",
        "id": str(uuid.uuid4()),
        "content": content,
        "info": f"build={datetime.now(timezone.utc).isoformat()}; hash={sha1}",
        "button": {"enabled": True, "buttons": []},
        "data": {},
        "export_with": {"data": True, "button": True},
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"已打包 {OUT_JSON}（{os.path.getsize(OUT_JSON) // 1024}KB · hash={sha1[:12]}）")


if __name__ == "__main__":
    main()
