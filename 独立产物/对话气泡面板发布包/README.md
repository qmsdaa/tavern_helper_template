# Counterfeit · 对话气泡设置面板发布说明

> **已废弃（deprecated）**：本目录的独立面板（Vue 3 + iframe + CDN）方案已被**同源内联面板**取代。
> 自 hotfix 起，`对话渲染-Counterfeit` 脚本内置了自包含的 HTML/CSS/JS 设置面板（主题 / 气泡字号 / 旁白字号 / 行距 / 头像大小 / 头像自定义 / 头像点击放大），**无需再部署 CDN 面板，也无需修改任何地址**。

## 新方案（推荐）

面板逻辑直接内置在 `角色卡工程/脚本/对话渲染.js` 的 `Part 7`（`openPanel` / `openAvatarZoom`）中：

- 打开方式：SillyTavern 魔棒菜单的「对话气泡」按钮，或控制台执行 `openBubblePanel()`。
- 所有设置实时生效并保存到浏览器 localStorage / IndexedDB，关闭面板即销毁 DOM，零外部依赖。
- 头像点击任意气泡头像或面板预览图可放大查看，点击遮罩 / 按 Esc 关闭。

打包命令（在 `角色卡工程/` 下）：

```bash
python build_tools/pack_dialogue_script.py
```

产物：

- `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json`（导入 SillyTavern）
- `独立产物/对话渲染-预览.html`（本地静态预览，真实跑渲染引擎）

## 旧方案（保留仅供历史参考）

早期的独立 iframe 面板（本目录下的 `index.html`）依赖 jsDelivr 加载 Vue 3 ESM，存在 CDN 加载不稳、跨域通信易失效的问题，现已废弃。以下步骤仅为历史记录：

1. 在 GitHub 新建公开仓库，上传本目录 `index.html`。
2. 通过 jsDelivr 访问：
   ```
   https://cdn.jsdelivr.net/gh/<你的用户名>/counterfeit-bubble-panel@latest/index.html
   ```
3. 旧脚本里曾存在的 `DEFAULT_PANEL_URL` 常量已随内联面板改造移除，不再需要配置。
