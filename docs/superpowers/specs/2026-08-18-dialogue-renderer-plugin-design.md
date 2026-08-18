# Counterfeit 对话渲染插件改造设计

## 背景

当前 `角色卡工程/脚本/对话渲染.js` 是一个酒馆助手脚本，负责把 `@bubble` 行渲染为聊天气泡，并提供了一个通过「对话气泡」按钮打开的简易设置面板。用户希望把它改造成更像「酒馆插件」的形态：入口在左下角魔棒菜单，支持切换主题、上传头像，并新增自定义字号和行距。

## 目标

- 保持现有渲染能力不变（气泡、场景头、内心、主题、头像）。
- 设置入口固定在酒馆左下角魔棒菜单，按钮名仍为「对话气泡」。
- 设置面板升级为正式的 Vue 前端界面，通过 iframe 弹窗承载。
- 面板内支持：
  - 主题切换（羊皮纸 / 暗夜 / 豆沙绿）
  - 头像自定义（URL / 本地上传 IndexedDB）
  - 自定义字号：气泡文字 12–18px（默认 15px），旁白文字 12–18px（默认 13.5px）
  - 自定义行距：1.4–2.0（默认 1.7）
- 配置持久化继续沿用 localStorage，保持与现有用户配置兼容。
- 最终产物仍可打包为单个 JSON 酒馆助手脚本，方便导入。

## 方案概述（方案 A：单一脚本 + iframe 设置面板）

保留现有脚本作为**渲染引擎**，负责：
- 注入格式提示词
- 渲染 `#chat .mes_text` 中的 `@bubble` 行与场景头
- 应用主题、字号、行距等样式
- 维护 IndexedDB 头像缓存

新增一个**前端界面项目** `前端工程/src/Counterfeit/界面/对话渲染/`，负责：
- 提供设置面板的 UI
- 读取/写入 localStorage 配置
- 通过 `postMessage` 通知外层脚本配置变更

脚本在点击魔棒按钮时，创建一个固定大小的 iframe 弹窗，加载打包后的前端界面 `dist/对话渲染/index.html`。iframe 内的设置变更实时通过 `postMessage` 同步给脚本，脚本立即重渲染并更新 CSS 变量。

## 架构

```
┌─────────────────────────────────────────┐
│           SillyTavern 主页面            │
│  ┌───────────────────────────────────┐  │
│  │  对话渲染脚本（渲染引擎）           │  │
│  │  - 注入 prompt                     │  │
│  │  - MutationObserver 渲染气泡       │  │
│  │  - 维护样式变量与 IndexedDB 头像   │  │
│  └───────────────────────────────────┘  │
│                    │                     │
│         点击魔棒「对话气泡」             │
│                    ▼                     │
│  ┌───────────────────────────────────┐  │
│  │      iframe 设置面板弹窗            │  │
│  │  （Vue + Pinia，本地打包）          │  │
│  │  - 主题 / 字号 / 行距 / 头像        │  │
│  └───────────────────────────────────┘  │
│                    │                     │
│         postMessage 配置变更             │
│                    ▼                     │
│         脚本更新样式并重渲染             │
└─────────────────────────────────────────┘
```

## 组件划分

### 1. 渲染脚本（改造现有 JS）

文件：`角色卡工程/脚本/对话渲染.js`

改造点：
- 新增配置字段 `bubbleFontSize`、`narrativeFontSize`、`lineHeight`，默认分别为 `15`、`13.5`、`1.7`。
- `STYLE_TEXT` 中使用 CSS 变量 `--cf-bubble-fs`、`--cf-narrative-fs`、`--cf-line-height`，由脚本根据配置动态写入 `<style>`。
- `loadConfig` 兼容旧配置：缺少新字段时回退到默认值。
- `applyConfig` 在配置变更时更新 CSS 变量并触发 `renderAllMessages(doc, true)` 重渲染。
- 监听 `message` 事件，接收 iframe 发来的 `cf-bubble-config-update` 消息并调用 `applyConfig`。
- `openPanel` 改为创建 iframe 弹窗而不是手写 DOM 面板。
- 保留 IndexedDB 头像上传逻辑。

### 2. 设置面板前端界面（新建）

目录：`前端工程/src/Counterfeit/界面/对话渲染/`

文件：
- `index.ts`：Vue 应用入口，挂载 App。
- `index.html`：宿主 HTML。
- `App.vue`：面板根组件。
- `store.ts`：Pinia store，管理配置状态，负责 localStorage 读写与 postMessage 通知父窗口。
- `components/ThemeSelector.vue`：主题三选一。
- `components/FontControls.vue`：字号、行距滑块 + 数值显示。
- `components/AvatarManager.vue`：角色头像列表，支持 URL 输入与文件上传。
- `global.css`：面板自身样式。

### 3. 构建产物

- `pnpm build` 在 `dist/对话渲染/index.html` 生成独立可加载的界面。
- 脚本中 iframe 的 `src` 指向该打包后的 URL（开发期用本地服务器，发布期上传到 CDN）。
- 最终 JSON 产物：`独立产物/酒馆助手脚本-对话渲染-Counterfeit.json` 仍只包含脚本，脚本负责加载面板 URL。

## 数据流

1. 脚本启动时从 localStorage 读取配置，应用 CSS 变量，渲染聊天。
2. 用户点击魔棒「对话气泡」→ 脚本创建 iframe 弹窗，URL 携带当前配置版本号避免缓存。
3. iframe 加载后通过 `postMessage` 请求当前配置；脚本回复完整配置。
4. 用户在面板中调整设置 → store 写入 localStorage 并 `postMessage` 通知脚本。
5. 脚本收到消息后更新 CSS 变量，触发全局重渲染。
6. 关闭面板时 iframe 发送 `cf-bubble-panel-close`，脚本移除弹窗。

## UI 布局

弹窗尺寸：`width: min(520px, 92vw)`，`max-height: 84vh`，居中显示，带遮罩。

面板分三区：
- **外观**：主题切换三按钮、启用/禁用开关。
- **排版**：
  - 气泡字号：滑块 12–18px，步进 0.5px，默认 15px。
  - 旁白字号：滑块 12–18px，步进 0.5px，默认 13.5px。
  - 行距：滑块 1.4–2.0，步进 0.05，默认 1.7。
- **头像**：角色列表，每行显示当前头像、名字、URL 输入框、上传按钮、重置按钮。

## 持久化

- 继续使用 localStorage key `cf_bubble_config_v1`，扩展字段：
  - `bubbleFontSize: number`
  - `narrativeFontSize: number`
  - `lineHeight: number`
- IndexedDB 头像存储不变，key 为角色名。
- iframe 与脚本共享同一个 localStorage（同源），因此 iframe 也可以直接读写配置，减少通信复杂度。

## 与现有脚本集成

- 不改动 `parseBubbleLine`、`renderBubblesInHtml` 等纯函数逻辑。
- 不改动头像表 `AVATAR_TABLE`、情绪词池 `MOOD_GROUPS`。
- 仅替换 `openPanel` 的实现，并增强 `STYLE_TEXT` 与配置管理。
- 单元测试 `test_dialogue_renderer.mjs` 继续通过。

## 构建与部署

1. 在前端工程执行 `pnpm build` 生成 `dist/对话渲染/index.html`。
2. 将 dist 目录上传到 CDN（与状态栏、手机界面同仓库）。
3. 更新脚本中的 `PANEL_URL` 为 CDN URL。
4. 运行 `pack_dialogue_script.py`（或等效流程）生成最终 JSON。

## 测试计划

- 单元测试：运行 `node 角色卡工程/build_tools/test_dialogue_renderer.mjs`，28 项测试全过。
- 本地预览：用 Playwright 打开 `独立产物/对话渲染-预览.html`，验证默认/暗夜/豆沙绿主题、字号/行距调整生效。
- 真实酒馆：通过 Chrome DevTools 连接已打开的酒馆页面，点击魔棒「对话气泡」打开面板，调整设置观察聊天实时变化。

## 风险与回退

- 风险：iframe 加载失败时面板无法打开。回退：脚本保留一个极简 DOM 面板作为 fallback。
- 风险：跨 iframe postMessage 被安全策略拦截。回退：iframe 与脚本同源共享 localStorage，可改为 iframe 自行写入配置并通知脚本刷新。
