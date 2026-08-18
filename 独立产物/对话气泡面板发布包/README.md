# Counterfeit · 对话气泡设置面板发布说明

## 快速发布到 GitHub

1. 在 GitHub 新建一个公开仓库，例如 `counterfeit-bubble-panel`。
2. 把本目录下的 `index.html` 上传到仓库根目录（可以直接拖拽到 GitHub 网页上传）。
3. 使用 jsDelivr CDN 地址访问：
   ```
   https://cdn.jsdelivr.net/gh/<你的用户名>/counterfeit-bubble-panel@latest/index.html
   ```
   例如：
   ```
   https://cdn.jsdelivr.net/gh/qmsdaa/counterfeit-bubble-panel@latest/index.html
   ```
4. 等待 1-2 分钟后，jsDelivr 会同步并缓存该文件。

## 修改脚本中的面板地址

打开 `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json`，找到 `content` 中的：

```js
const DEFAULT_PANEL_URL = 'https://cdn.jsdelivr.net/gh/<user>/counterfeit-bubble-panel@latest/index.html';
```

把 `<user>` 改成你的 GitHub 用户名，然后保存并重新导入到 SillyTavern。

## 本地开发

如果你想本地调试面板，可以在 SillyTavern 控制台执行：

```js
localStorage.setItem('cf_bubble_panel_url', 'http://localhost:6621/dist/Counterfeit/界面/对话渲染/index.html')
```

然后刷新页面即可覆盖默认 CDN 地址。
