# Counterfeit 对话渲染插件改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有对话渲染脚本升级为「单一脚本 + iframe 设置面板」的酒馆插件形态，支持通过魔棒「对话气泡」按钮打开 Vue 设置面板，实现主题切换、头像上传、自定义字号与行距。

**Architecture:** 保留 `角色卡工程/脚本/对话渲染.js` 作为渲染引擎，仅增强配置管理、CSS 变量与 iframe 弹窗能力；新建 `前端工程/src/Counterfeit/界面/对话渲染/` Vue 前端界面项目作为设置面板，负责 UI 交互与 localStorage 读写；两者通过同源 shared localStorage + postMessage 同步变更。

**Tech Stack:** TypeScript, Vue 3, Pinia, Tailwind CSS, webpack, localStorage, IndexedDB, Playwright

---

## 文件结构

新建与修改的文件：

- `角色卡工程/脚本/对话渲染.js` —— 渲染引擎，新增配置字段、CSS 变量、iframe 弹窗、postMessage 通信
- `前端工程/src/Counterfeit/界面/对话渲染/index.ts` —— 前端界面入口
- `前端工程/src/Counterfeit/界面/对话渲染/index.html` —— 前端界面宿主
- `前端工程/src/Counterfeit/界面/对话渲染/App.vue` —— 面板根组件
- `前端工程/src/Counterfeit/界面/对话渲染/store.ts` —— Pinia store，配置读写与父窗口通信
- `前端工程/src/Counterfeit/界面/对话渲染/components/ThemeSelector.vue` —— 主题切换
- `前端工程/src/Counterfeit/界面/对话渲染/components/FontControls.vue` —— 字号/行距滑块
- `前端工程/src/Counterfeit/界面/对话渲染/components/AvatarManager.vue` —— 头像管理
- `前端工程/src/Counterfeit/界面/对话渲染/global.css` —— 面板样式
- `独立产物/对话渲染-预览.html` —— 同步更新以支持新配置字段的预览
- `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json` —— 最终打包产物，由脚本更新后重新生成

---

## Task 1: 扩展渲染脚本的配置结构与 CSS 变量

**Files:**
- Modify: `角色卡工程/脚本/对话渲染.js`

目标：在脚本中引入 `bubbleFontSize`、`narrativeFontSize`、`lineHeight` 三个新配置字段，并把它们映射到 CSS 变量，让样式可以动态调整。

- [ ] **Step 1: 修改 `loadConfig` 与默认配置对象**

找到脚本中 `loadConfig` 函数，把默认配置扩展为：

```js
function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    return raw
      ? { enabled: true, theme: 'parchment', bubbleFontSize: 15, narrativeFontSize: 13.5, lineHeight: 1.7, ...JSON.parse(raw) }
      : { enabled: true, theme: 'parchment', bubbleFontSize: 15, narrativeFontSize: 13.5, lineHeight: 1.7 };
  } catch (_) {
    return { enabled: true, theme: 'parchment', bubbleFontSize: 15, narrativeFontSize: 13.5, lineHeight: 1.7 };
  }
}
```

- [ ] **Step 2: 新增 `applyConfig` 函数**

在 `applyTheme` 附近新增：

```js
function applyConfig(doc) {
  const cfg = loadConfig();
  const chat = doc.getElementById('chat');
  if (!chat) return;
  chat.style.setProperty('--cf-bubble-fs', `${cfg.bubbleFontSize}px`);
  chat.style.setProperty('--cf-narrative-fs', `${cfg.narrativeFontSize}px`);
  chat.style.setProperty('--cf-line-height', cfg.lineHeight);
}
```

- [ ] **Step 3: 在 `renderAllMessages` 中调用 `applyConfig`**

```js
function renderAllMessages(doc, force = false) {
  ensureStyle(doc);
  applyTheme(doc);
  applyConfig(doc);
  // ... 原逻辑不变
}
```

- [ ] **Step 4: 修改 `STYLE_TEXT`，把字号和行距改成 CSS 变量**

把下面这段样式：

```css
.cf-bub{display:flex;gap:12px;margin:14px 4px;align-items:flex-start;font-size:15px;line-height:1.7}
```

改为：

```css
.cf-bub{display:flex;gap:12px;margin:14px 4px;align-items:flex-start;font-size:var(--cf-bubble-fs,15px);line-height:var(--cf-line-height,1.7)}
```

把气泡文字样式：

```css
.cf-bub-bubble{...font-size:15px;line-height:1.7}
```

改为：

```css
.cf-bub-bubble{...font-size:var(--cf-bubble-fs,15px);line-height:var(--cf-line-height,1.7)}
```

把旁白样式：

```css
#chat .cf-bub-host>p:not(:has(img)){...line-height:1.75;margin:8px 2px;font-size:13.5px;opacity:.95}
```

改为：

```css
#chat .cf-bub-host>p:not(:has(img)){...line-height:var(--cf-line-height,1.75);margin:8px 2px;font-size:var(--cf-narrative-fs,13.5px);opacity:.95}
```

- [ ] **Step 5: 运行单元测试**

Run: `node 角色卡工程/build_tools/test_dialogue_renderer.mjs`
Expected: 28 tests pass

- [ ] **Step 6: Commit**

```bash
git add 角色卡工程/脚本/对话渲染.js
git commit -m "feat(bubble): add font-size and line-height config via CSS vars"
```

---

## Task 2: 渲染脚本支持 postMessage 与 iframe 弹窗

**Files:**
- Modify: `角色卡工程/脚本/对话渲染.js`

目标：把原本手写的 DOM 设置面板替换成 iframe 弹窗，并监听 iframe 发来的配置变更。

- [ ] **Step 1: 定义面板 URL 常量**

在脚本顶部（`PROMPT_INJECTION_ID` 附近）新增：

```js
const PANEL_URL = 'http://localhost:6621/dist/Counterfeit/界面/对话渲染/index.html';
```

发布前改为实际 CDN URL。

- [ ] **Step 2: 重写 `openPanel` 函数**

替换整个 `openPanel` 函数为 iframe 弹窗实现：

```js
function openPanel(doc) {
  if (doc.getElementById('cf-bubble-panel-mask')) return;

  const mask = doc.createElement('div');
  mask.id = 'cf-bubble-panel-mask';
  mask.className = 'cf-panel-mask';

  const iframe = doc.createElement('iframe');
  iframe.id = 'cf-bubble-panel-iframe';
  iframe.className = 'cf-panel-iframe';
  iframe.src = `${PANEL_URL}?v=${Date.now()}`;
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');

  const close = () => { mask.remove(); iframe.remove(); };
  mask.addEventListener('click', close);

  doc.body.appendChild(mask);
  doc.body.appendChild(iframe);
}

function closePanel(doc) {
  doc.getElementById('cf-bubble-panel-mask')?.remove();
  doc.getElementById('cf-bubble-panel-iframe')?.remove();
}
```

- [ ] **Step 3: 新增 iframe 样式到 `STYLE_TEXT`**

在 `STYLE_TEXT` 末尾追加：

```css
.cf-panel-iframe{position:fixed;top:8vh;left:50%;transform:translateX(-50%);width:min(520px,92vw);height:min(680px,84vh);border:none;border-radius:14px;z-index:99991;box-shadow:0 8px 40px rgba(90,60,70,.25);background:#fdfaf4}
```

- [ ] **Step 4: 新增 `message` 事件监听**

在 `boot()` 函数中注册 `message` 事件：

```js
function onPanelMessage(event) {
  const data = event.data;
  if (!data || data.source !== 'cf-bubble-panel') return;
  const doc = findHostDocument();
  if (!doc) return;
  if (data.type === 'config-update') {
    saveConfig({ ...loadConfig(), ...data.config });
    applyTheme(doc);
    applyConfig(doc);
    if (loadConfig().enabled) renderAllMessages(doc, true);
  } else if (data.type === 'close-panel') {
    closePanel(doc);
  } else if (data.type === 'request-config') {
    event.source.postMessage({ source: 'cf-bubble-script', type: 'init-config', config: loadConfig() }, '*');
  }
}
```

在 `boot()` 中：

```js
function boot() {
  const doc = findHostDocument();
  if (!doc) {
    setTimeout(boot, 1200);
    return;
  }
  // ... 原有初始化代码 ...
  doc.defaultView.addEventListener('message', onPanelMessage);
}
```

- [ ] **Step 5: 运行单元测试**

Run: `node 角色卡工程/build_tools/test_dialogue_renderer.mjs`
Expected: 28 tests pass

- [ ] **Step 6: Commit**

```bash
git add 角色卡工程/脚本/对话渲染.js
git commit -m "feat(bubble): replace DOM panel with iframe panel and postMessage sync"
```

---

## Task 3: 新建前端界面项目骨架

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/index.html`
- Create: `前端工程/src/Counterfeit/界面/对话渲染/index.ts`
- Create: `前端工程/src/Counterfeit/界面/对话渲染/global.css`

目标：创建能被 webpack 自动识别并打包成独立 HTML 的前端界面项目。

- [ ] **Step 1: 创建 `index.html`**

```html
<!DOCTYPE html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Counterfeit · 对话气泡设置</title>
</head>
<body>
  <div id="app"></div>
</body>
```

- [ ] **Step 2: 创建 `index.ts`**

```ts
import App from './App.vue';
import './global.css';

const jq = (window as any).$ as JQueryStatic | undefined;
const ready = (fn: () => void) =>
  typeof jq === 'function' ? jq(fn) : document.addEventListener('DOMContentLoaded', fn);

ready(() => {
  const app = createApp(App).use(createPinia());
  app.mount('#app');
  if (typeof jq === 'function') {
    jq(window).on('pagehide', () => app.unmount());
  } else {
    window.addEventListener('pagehide', () => app.unmount());
  }
});
```

- [ ] **Step 3: 创建 `global.css`**

```css
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background: #fdfaf4;
  color: #5b4a4f;
}
#app {
  padding: 18px 20px;
}
```

- [ ] **Step 4: 验证 webpack 能识别新入口**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功，输出 `dist/Counterfeit/界面/对话渲染/index.html`

- [ ] **Step 5: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/index.html 前端工程/src/Counterfeit/界面/对话渲染/index.ts 前端工程/src/Counterfeit/界面/对话渲染/global.css
git commit -m "feat(bubble-panel): scaffold Vue frontend project for bubble settings"
```

---

## Task 4: 实现 Pinia Store 与父窗口通信

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/store.ts`

目标：store 负责 localStorage 读写、字段校验、postMessage 通知父窗口。

- [ ] **Step 1: 创建 `store.ts`**

```ts
import { klona } from 'klona';
import { z } from 'zod';

const LS_CONFIG_KEY = 'cf_bubble_config_v1';

const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  theme: z.enum(['parchment', 'dark', 'green']).default('parchment'),
  bubbleFontSize: z.number().min(12).max(18).default(15),
  narrativeFontSize: z.number().min(12).max(18).default(13.5),
  lineHeight: z.number().min(1.4).max(2.0).default(1.7),
});

export type BubbleConfig = z.infer<typeof ConfigSchema>;

function loadConfig(): BubbleConfig {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    return ConfigSchema.parse(raw ? JSON.parse(raw) : {});
  } catch (_) {
    return ConfigSchema.parse({});
  }
}

function saveConfig(config: BubbleConfig) {
  try {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
  } catch (_) {}
}

function notifyParent(config: BubbleConfig) {
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: klona(config) }, '*');
}

export const useBubbleStore = defineStore('bubble', () => {
  const config = ref<BubbleConfig>(loadConfig());

  function updateConfig(patch: Partial<BubbleConfig>) {
    const next = ConfigSchema.parse({ ...config.value, ...patch });
    config.value = next;
    saveConfig(next);
    notifyParent(next);
  }

  function closePanel() {
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'close-panel' }, '*');
  }

  onMounted(() => {
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'request-config' }, '*');
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'cf-bubble-script' || data.type !== 'init-config') return;
      config.value = ConfigSchema.parse(data.config);
    };
    window.addEventListener('message', handler);
    onUnmounted(() => window.removeEventListener('message', handler));
  });

  return { config, updateConfig, closePanel };
});
```

- [ ] **Step 2: 构建验证**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/store.ts
git commit -m "feat(bubble-panel): add pinia store with localStorage and postMessage sync"
```

---

## Task 5: 实现主题切换组件

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/components/ThemeSelector.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <section class="mb-5">
    <h3 class="text-sm font-semibold text-[#a5737f] mb-2 tracking-wide">主题</h3>
    <div class="flex gap-2">
      <button
        v-for="t in themes"
        :key="t.id"
        class="flex-1 py-1.5 text-xs rounded-lg border transition"
        :class="config.theme === t.id ? 'bg-[#e87a90] text-white border-[#e87a90]' : 'bg-white text-[#5b4a4f] border-[#e3d3d8] hover:border-[#e87a90]'"
        @click="updateConfig({ theme: t.id })"
      >
        {{ t.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBubbleStore } from '../store';
const { config, updateConfig } = useBubbleStore();

const themes = [
  { id: 'parchment', label: '羊皮纸' },
  { id: 'dark', label: '暗夜' },
  { id: 'green', label: '豆沙绿' },
];
</script>
```

- [ ] **Step 2: 构建验证**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/components/ThemeSelector.vue
git commit -m "feat(bubble-panel): add theme selector component"
```

---

## Task 6: 实现字号/行距控制组件

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/components/FontControls.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <section class="mb-5 space-y-3">
    <h3 class="text-sm font-semibold text-[#a5737f] tracking-wide">排版</h3>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>气泡字号</span>
        <span class="text-[#c05a72] font-medium">{{ config.bubbleFontSize }}px</span>
      </div>
      <input
        type="range" min="12" max="18" step="0.5"
        :value="config.bubbleFontSize"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ bubbleFontSize: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>旁白字号</span>
        <span class="text-[#c05a72] font-medium">{{ config.narrativeFontSize }}px</span>
      </div>
      <input
        type="range" min="12" max="18" step="0.5"
        :value="config.narrativeFontSize"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ narrativeFontSize: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>行距</span>
        <span class="text-[#c05a72] font-medium">{{ config.lineHeight }}</span>
      </div>
      <input
        type="range" min="1.4" max="2.0" step="0.05"
        :value="config.lineHeight"
        class="w-full accent-[#e87a90]"
        @input="updateConfig({ lineHeight: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBubbleStore } from '../store';
const { config, updateConfig } = useBubbleStore();
</script>
```

- [ ] **Step 2: 构建验证**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/components/FontControls.vue
git commit -m "feat(bubble-panel): add font size and line height sliders"
```

---

## Task 7: 实现头像管理组件

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/components/AvatarManager.vue`

目标：列出所有角色（预置 + 已出现），支持 URL 输入和本地上传，数据存 IndexedDB，URL 存 localStorage。

- [ ] **Step 1: 创建组件**

```vue
<template>
  <section>
    <h3 class="text-sm font-semibold text-[#a5737f] mb-2 tracking-wide">头像自定义</h3>
    <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
      <div v-for="name in names" :key="name" class="flex items-center gap-2 py-1.5 border-b border-dashed border-[#f0e4e7]">
        <img :src="avatarSrc(name)" class="w-9 h-9 rounded-full object-cover bg-[#f3ece2]" />
        <span class="w-24 text-xs font-semibold truncate">{{ name }}</span>
        <input
          type="text"
          :value="customUrls[name] || ''"
          placeholder="图片 URL"
          class="flex-1 min-w-0 text-xs border border-[#e3d3d8] rounded-lg px-2 py-1 bg-white"
          @change="onUrlChange(name, ($event.target as HTMLInputElement).value)"
        />
        <button class="px-2 py-1 text-xs rounded-lg border border-[#e87a90] text-[#c05a72] hover:bg-[#e87a90] hover:text-white" @click="uploadAvatar(name)">上传</button>
        <button class="px-2 py-1 text-xs rounded-lg border border-[#e3d3d8] text-[#a08a90] hover:border-[#e87a90]" @click="resetAvatar(name)">重置</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { AVATAR_TABLE, KNOWN_NO_AVATAR } from '../avatar-data';
import { loadCustomUrls, saveCustomUrls, idbPut, idbDelete } from '../idb';

const props = defineProps<{ seenNames?: string[] }>();
const customUrls = ref<Record<string, string>>(loadCustomUrls());
const uploadCache = ref<Record<string, string>>({});

const names = computed(() => {
  const set = new Set([...Object.keys(AVATAR_TABLE), ...KNOWN_NO_AVATAR, ...(props.seenNames || [])]);
  return [...set];
});

function avatarSrc(name: string) {
  return uploadCache.value[name] || customUrls.value[name] || AVATAR_TABLE[name] || '';
}

function onUrlChange(name: string, value: string) {
  const urls = { ...customUrls.value };
  if (value.trim()) urls[name] = value.trim();
  else delete urls[name];
  customUrls.value = urls;
  saveCustomUrls(urls);
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
}

async function uploadAvatar(name: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    await idbPut(name, file);
    uploadCache.value[name] = URL.createObjectURL(file);
    window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
  };
  input.click();
}

async function resetAvatar(name: string) {
  const urls = { ...customUrls.value };
  delete urls[name];
  customUrls.value = urls;
  saveCustomUrls(urls);
  await idbDelete(name);
  delete uploadCache.value[name];
  window.parent.postMessage({ source: 'cf-bubble-panel', type: 'config-update', config: { ...loadConfig(), _avatarTick: Date.now() } }, '*');
}
</script>
```

- [ ] **Step 2: 提取共享数据与 IndexedDB 工具到前端界面**

创建 `前端工程/src/Counterfeit/界面/对话渲染/avatar-data.ts`：

```ts
export const AVATAR_BASE = 'https://cdn.jsdelivr.net/gh/qmsdaa/tavern_helper_template_cdn@0fa8d8a2aea96fb68f9877263ab3b5fe8c0ee353/assets/Counterfeit/状态栏/avatars';

export const AVATAR_KEYS: Record<string, string> = {
  '比企谷八幡': 'hachiman', '雪之下雪乃': 'yukino', '由比滨结衣': 'yui',
  '拉芙希妮·都柏林': 'laff', '一色彩羽': 'iroha', '三浦优美子': 'yumiko',
  '叶山隼人': 'hayama', '平冢静': 'shizuka', '户冢彩加': 'saika',
  '雪之下阳乃': 'haruno', '爱布拉娜·都柏林': 'eblana', '爱布拉娜': 'eblana',
  '比企谷小町': 'komachi', '川崎沙希': 'saki', '雪之下夫人': 'mrs_yukinoshita',
  '材木座义辉': 'zaimokuza', '海老名姬菜': 'ebina', '相模南': 'sagami',
  '折本香织': 'orimoto', '户部翔': 'tobe',
};

export const AVATAR_TABLE: Record<string, string> = Object.fromEntries(
  Object.entries(AVATAR_KEYS).map(([name, key]) => [name, `${AVATAR_BASE}/${key}.webp`])
);

export const KNOWN_NO_AVATAR = ['大和', '大冈', '城廻巡', '玉绳', '由比滨母亲', '鹤见留美', '川崎京华'];
```

创建 `前端工程/src/Counterfeit/界面/对话渲染/idb.ts`：

```ts
const IDB_NAME = 'CounterfeitBubbleAvatars';
const IDB_STORE = 'uploads';
const LS_URL_KEY = 'cf_bubble_custom_urls_v1';

export function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(name: string, blob: Blob) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(name: string) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function loadCustomUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_URL_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

export function saveCustomUrls(map: Record<string, string>) {
  try {
    localStorage.setItem(LS_URL_KEY, JSON.stringify(map));
  } catch (_) {}
}
```

- [ ] **Step 3: 构建验证**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/components/AvatarManager.vue 前端工程/src/Counterfeit/界面/对话渲染/avatar-data.ts 前端工程/src/Counterfeit/界面/对话渲染/idb.ts
git commit -m "feat(bubble-panel): add avatar manager with url and indexeddb upload"
```

---

## Task 8: 组装 App.vue 面板根组件

**Files:**
- Create: `前端工程/src/Counterfeit/界面/对话渲染/App.vue`

- [ ] **Step 1: 创建 App.vue**

```vue
<template>
  <div class="relative">
    <button class="absolute top-0 right-0 text-xl leading-none text-[#a5737f] hover:text-[#c05a72]" @click="closePanel">×</button>
    <h2 class="text-base font-bold text-[#c05a72] mb-4 tracking-widest">🌸 对话气泡 · Counterfeit</h2>

    <label class="flex items-center gap-2 text-xs mb-5 cursor-pointer">
      <input type="checkbox" :checked="config.enabled" @change="updateConfig({ enabled: ($event.target as HTMLInputElement).checked })" />
      <span>启用对话气泡渲染与格式注入</span>
    </label>

    <ThemeSelector />
    <FontControls />
    <AvatarManager />

    <p class="mt-4 text-[11px] text-[#a08a90] leading-relaxed">
      主题、字号、行距调整会实时生效；头像 URL 与上传图均保存在浏览器本地，不上传服务器。
    </p>
  </div>
</template>

<script setup lang="ts">
import { useBubbleStore } from './store';
import ThemeSelector from './components/ThemeSelector.vue';
import FontControls from './components/FontControls.vue';
import AvatarManager from './components/AvatarManager.vue';

const { config, updateConfig, closePanel } = useBubbleStore();
</script>
```

- [ ] **Step 2: 构建验证**

Run: `cd 前端工程 && pnpm build:dev`
Expected: 构建成功，生成 `dist/Counterfeit/界面/对话渲染/index.html`

- [ ] **Step 3: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/对话渲染/App.vue
git commit -m "feat(bubble-panel): assemble settings panel app"
```

---

## Task 9: 同步更新预览页与产物 JSON

**Files:**
- Modify: `独立产物/对话渲染-预览.html`
- Modify: `独立产物/酒馆助手脚本-对话渲染-Counterfeit.json`

- [ ] **Step 1: 在预览页里内嵌一个简易配置面板用于本地验证**

在 `独立产物/对话渲染-预览.html` 的 `<body>` 顶部新增一段 HTML 配置区：

```html
<div id="config-bar" style="display:flex;gap:10px;justify-content:center;margin:0 auto 14px;max-width:520px;flex-wrap:wrap">
  <button data-t="parchment">羊皮纸</button>
  <button data-t="dark">暗夜</button>
  <button data-t="green">豆沙绿</button>
  <label>气泡字号 <input id="bubble-fs" type="range" min="12" max="18" step="0.5" value="15" /></label>
  <label>旁白字号 <input id="narrative-fs" type="range" min="12" max="18" step="0.5" value="13.5" /></label>
  <label>行距 <input id="line-height" type="range" min="1.4" max="2.0" step="0.05" value="1.7" /></label>
</div>
```

在脚本 boot 之后或样式注入之后，新增一段 JS 把配置同步到 CSS 变量：

```js
function applyPreviewConfig() {
  const chat = document.getElementById('chat');
  chat.style.setProperty('--cf-bubble-fs', document.getElementById('bubble-fs').value + 'px');
  chat.style.setProperty('--cf-narrative-fs', document.getElementById('narrative-fs').value + 'px');
  chat.style.setProperty('--cf-line-height', document.getElementById('line-height').value);
}
['input','change'].forEach(evt => {
  document.getElementById('bubble-fs').addEventListener(evt, applyPreviewConfig);
  document.getElementById('narrative-fs').addEventListener(evt, applyPreviewConfig);
  document.getElementById('line-height').addEventListener(evt, applyPreviewConfig);
});
applyPreviewConfig();
```

- [ ] **Step 2: 用 Python 脚本把更新后的 `角色卡工程/脚本/对话渲染.js` 重新写入 JSON 产物**

Run:

```bash
python C:\Users\wzh\AppData\Local\Temp\opencode\update_dialogue_json.py
```

Expected: 输出 `JSON updated.`

- [ ] **Step 3: Commit**

```bash
git add 独立产物/对话渲染-预览.html 独立产物/酒馆助手脚本-对话渲染-Counterfeit.json
git commit -m "feat(bubble): sync preview and json artifact with new config panel"
```

---

## Task 10: 端到端测试

**Files:**
- Create: `C:\Users\wzh\AppData\Local\Temp\opencode\test_bubble_panel.py`（临时测试脚本）

- [ ] **Step 1: 启动前端开发服务器**

Run: `cd 前端工程 && pnpm watch`
保持运行，在另一个终端执行测试。

- [ ] **Step 2: 运行单元测试**

Run: `node 角色卡工程/build_tools/test_dialogue_renderer.mjs`
Expected: 28 tests pass

- [ ] **Step 3: 用 Playwright 打开预览页并截图**

创建临时脚本：

```python
from playwright.sync_api import sync_playwright
from pathlib import Path

html = Path(r'D:\神了\Counterfeit-v0.6.0-完整工程-hotfix2-20260814\Counterfeit-v0.6.0-完整工程-hotfix2\独立产物\对话渲染-预览.html')
out = Path(r'D:\神了\Counterfeit-v0.6.0-完整工程-hotfix2-20260814\Counterfeit-v0.6.0-完整工程-hotfix2\独立产物\对话渲染-预览-插件化.png')

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 720, 'height': 900})
    page.goto(f'file:///{html.as_posix()}')
    page.wait_for_timeout(1000)
    page.screenshot(path=str(out), full_page=True)
    b.close()
print('done', out)
```

Run: `python C:\Users\wzh\AppData\Local\Temp\opencode\test_bubble_panel.py`
Expected: 生成截图文件

- [ ] **Step 4: 手动验证 iframe 面板（真实酒馆或本地服务器）**

在浏览器打开 `http://localhost:6621/dist/Counterfeit/界面/对话渲染/index.html`，确认：
- 主题按钮可点击
- 字号/行距滑块拖动后页面实时变化
- 头像 URL 输入和上传按钮存在

- [ ] **Step 5: Commit 测试结果截图（可选）**

```bash
git add 独立产物/对话渲染-预览-插件化.png
git commit -m "test(bubble): add plugin preview screenshot"
```

---

## 自我审查

- **Spec coverage:**
  - 主题切换：Task 5 ✅
  - 头像上传/URL：Task 7 ✅
  - 自定义字号/行距：Task 1 + Task 6 ✅
  - 魔棒入口：Task 2（`openPanel` 由 `getButtonEvent('对话气泡')` 触发）✅
  - localStorage 持久化：Task 1 + Task 4 ✅
  - 前端界面项目：Task 3 ✅
  - 预览页同步：Task 9 ✅
  - 测试：Task 10 ✅

- **Placeholder scan:** 无 TBD/TODO，所有步骤均含具体代码与命令 ✅
- **Type consistency:** store 中的配置字段与脚本中的 `loadConfig` 字段一致：`enabled`, `theme`, `bubbleFontSize`, `narrativeFontSize`, `lineHeight` ✅
