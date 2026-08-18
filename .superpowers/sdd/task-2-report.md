# Task 2 Report: 渲染脚本支持 postMessage 与 iframe 弹窗

## Status

完成 ✅

## Files Modified

- `角色卡工程/脚本/对话渲染.js`

## Changes Summary

1. 在 `PROMPT_INJECTION_ID` 附近新增常量：
   ```js
   const PANEL_URL = 'http://localhost:6621/dist/Counterfeit/界面/对话渲染/index.html';
   ```

2. 将原有的手写 DOM 设置面板 (`openPanel`) 替换为 iframe 弹窗实现，并新增 `closePanel`：
   - 创建 `cf-bubble-panel-mask` 遮罩
   - 创建 `cf-bubble-panel-iframe` 并加载 `PANEL_URL?v=Date.now()`
   - 点击遮罩关闭面板

3. 在 `STYLE_TEXT` 末尾追加 `.cf-panel-iframe` 样式。

4. 新增 `onPanelMessage` 消息处理函数，监听 `source === 'cf-bubble-panel'` 的 postMessage：
   - `config-update`: 合并 patch 到当前配置，保存，应用主题/配置，启用时强制重渲染
   - `close-panel`: 移除 iframe 与遮罩
   - `request-config`: 向 iframe 回复当前完整配置

5. 在 `boot()` 中通过 `doc.defaultView.addEventListener('message', onPanelMessage)` 注册消息监听。

6. 删除了原面板相关的 DOM 构建代码与 `renderAllMessagesSilent` 辅助函数；IndexedDB 头像上传逻辑（`idbOpen` / `idbPut` / `idbGet` / `idbDelete`）保持完整，未做改动或复制。

## Test Command Output

```
node 角色卡工程/build_tools/test_dialogue_renderer.mjs
```

结果：28 个测试全部通过。

```
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 35.7465
```

## Commit

- **Hash:** `6baf9c1`
- **Message:** `feat(bubble): replace DOM panel with iframe panel and postMessage sync`

## Concerns

- `PANEL_URL` 当前指向本地开发服务器 `http://localhost:6621/...`，发布前需要改为实际 CDN URL。
- 原面板中的头像自定义 UI 已完全移入 iframe；需要确保 iframe 页面实现对应的配置表单、头像 URL/上传/重置功能，并正确发送 `config-update` / `close-panel` / `request-config` 消息。
- 未对 iframe 的 `event.origin` 做校验，当前使用 `'*'` 回复；若面板部署到 CDN，建议后续按实际 origin 白名单校验以提升安全性。

---

# Task 2 Fix Report: iframe origin 校验与清理死 CSS

## Status

已修复 ✅

## Issues Fixed

1. **Security（重要）**: `onPanelMessage` 未校验 `event.origin`，且 `request-config` 使用 `'**'` 作为目标 origin。
   - 在脚本加载时从 `PANEL_URL` 计算并缓存 `PANEL_ORIGIN`：
     ```js
     const PANEL_ORIGIN = new URL(PANEL_URL).origin;
     ```
   - `onPanelMessage` 入口先校验来源：
     ```js
     if (event.origin !== PANEL_ORIGIN) return;
     ```
   - `request-config` 回复时改用 `event.origin` 作为目标 origin，替代 `'**'`：
     ```js
     event.source.postMessage({ source: 'cf-bubble-script', type: 'init-config', config: loadConfig() }, event.origin);
     ```

2. **Minor**: 移除 `STYLE_TEXT` 中不再使用的 `.cf-panel` DOM 面板样式规则，保留 `.cf-panel-mask` 与 `.cf-panel-iframe`。

## Files Modified

- `角色卡工程/脚本/对话渲染.js`

## Constraints Respected

- 未改动任何纯函数逻辑（`parseBubbleLine`、`renderBubblesInHtml`、`renderMessageHtml`、`parseSceneHeader`、`buildInjectionText`、情绪词池、头像表等）。
- 保留 `config-update`、`close-panel`、`request-config` 三类消息及其原有行为。

## Test Command Output

```
node 角色卡工程/build_tools/test_dialogue_renderer.mjs
```

结果：28 个测试全部通过。

```
✔ parseBubbleLine 解析标准台词行 (3.0307ms)
✔ parseBubbleLine 解析内心行（外层 *...*） (0.7504ms)
✔ parseBubbleLine 容忍全角竖线与首尾空白 (0.4515ms)
✔ parseBubbleLine 拒绝缺段/嵌套方括号/空情绪 (0.2321ms)
✔ renderBubblesInHtml 渲染 <p> 包裹的气泡行 (1.2233ms)
✔ renderBubblesInHtml 渲染 <br> 分隔的独立行 (0.3728ms)
✔ renderBubblesInHtml 内心行带 inner 变体与虚线标签 (1.7246ms)
✔ renderBubblesInHtml 行内混入其他文字时不渲染（保原文） (0.1643ms)
✔ renderBubblesInHtml 不触碰 <update> 变量块 (0.341ms)
✔ renderBubblesInHtml 未知角色渲染首字占位而非崩图 (0.3015ms)
✔ renderBubblesInHtml 未知情绪用灰描边，词池情绪用组色 (0.4898ms)
✔ renderBubblesInHtml 含尖括号的台词行不渲染（不引入新注入面） (0.1571ms)
✔ renderBubblesInHtml 台词中的引号与 & 被转义 (0.1626ms)
✔ renderBubblesInHtml <em> 整段包裹 ≡ 内心标记（showdown 吃掉星号的实测形态） (0.1675ms)
✔ renderBubblesInHtml <em>+星号双重包裹也识别为内心 (0.136ms)
✔ renderBubblesInHtml 台词中段 <em> 保留为斜体且仍是台词气泡 (0.1419ms)
✔ renderBubblesInHtml 全角冒号 @bubble： 同权接受 (0.1244ms)
✔ renderBubblesInHtml \n 分隔的混排段落（不开 simpleLineBreaks 的 showdown 形态） (0.1272ms)
✔ renderBubblesInHtml <p> 开头即气泡行的混排段落也能命中（<p> 边界） (0.1039ms)
✔ renderBubblesInHtml 非 em/i 的标签仍拒绝渲染（注入面不扩大） (0.0833ms)
✔ parseSceneHeader 解析四段式场景头，首段为时间 (0.2806ms)
✔ parseSceneHeader 拒绝单段/两段与含尖括号 (0.1108ms)
✔ renderMessageHtml 场景头渲染为横幅且旁白段落原样保留 (0.4287ms)
✔ renderMessageHtml 同一条消息里场景头 + 多个气泡 + 旁白共存 (0.2308ms)
✔ renderMessageHtml 单竖线【】不误判为场景头 (0.1957ms)
✔ buildInjectionText 要求 NPC 台词走 @bubble 且正文不直写引号台词 (0.2509ms)
✔ buildInjectionText 保留契约兼容声明与完整情绪词池 (0.1269ms)
✔ 头像表与无头像名单不重叠且键名齐全 (0.179ms)
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 22.9092
```

## Commit

- **Hash:** `241ad97`
- **Message:** `fix(bubble): validate iframe origin and remove dead panel CSS`

## Summary

通过 `PANEL_ORIGIN` 白名单校验 iframe postMessage 来源，消除 `request-config` 对 `'**'` 目标 origin 的使用；同时清理了已废弃的 `.cf-panel` CSS 规则，保持样式精简。全部 28 个无头测试通过。
