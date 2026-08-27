# 《Counterfeit》开场白视频化重构 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Seedance 图生视频替换开场白的静态 CG 代码运镜序奏，并将标题屏樱花背景动态化（双画幅自适应 + 完整降级链）。

**Architecture:** 新增 `introVideos.ts` 播放清单模块（纯逻辑，node --test 单测）；重写 `IntroSequence.vue` 为双 `<video>` 交叉叠化播放器（字幕 DOM 叠加、poster 静态图降级、全灭直进标题屏）；`TitleScreen.vue` 背景换循环视频。素材（12 条序奏 + 2 条标题循环 + 14 张首帧图）由用户按 Task 6 的提示词文档在外部生成，Task 8 入库。

**Tech Stack:** Vue 3 `<script setup lang="ts">` + Pinia + webpack（`npm run build`）+ node:test（`node tests/prepare-opening.mjs && node --test tests/introVideos.test.ts`）+ Real-ESRGAN（realesrgan-ncnn-vulkan）+ ffmpeg。

**Spec:** `docs/superpowers/specs/2026-08-27-opening-video-redesign-design.md`

**仓库根：** `D:\神了\Counterfeit-v0.6.0-完整工程-hotfix2-20260814\Counterfeit-v0.6.0-完整工程-hotfix2`（下文所有相对路径基于此；前端工程在 `前端工程/` 子目录）

**测试惯例：** 本仓库无 vitest；纯逻辑模块用 `node --test` + `tests/prepare*.mjs`（把 src 复制到 `tests/.build*/` 并补全 `.ts` 扩展名）。UI 组件无单测设施，靠 `npm run build`（含 TS 检查）+ `npm run lint` + 手动 QA 验证，不为本次重构引入新测试框架（YAGNI）。

---

### Task 1: introVideos.ts 播放清单模块（TDD）

**Files:**
- Create: `前端工程/src/Counterfeit/界面/开场白/introVideos.ts`
- Create: `前端工程/tests/introVideos.test.ts`
- Create: `前端工程/tests/prepare-opening.mjs`

模块职责：序奏 6 拍 + 标题屏循环的清单数据、画幅选源、URL 构建、预载。参照被替代的 `introAssets.ts` 的 URL 模式（`ASSET_BASE` + `?v=ASSET_VERSION`）。

- [ ] **Step 1: 写 prepare 脚本（测试基建）**

```js
// 前端工程/tests/prepare-opening.mjs
// 开场白测试准备：把开场白源码复制到 tests/.build-opening/，补全 .ts 扩展名，
// 并把 '../../config' 重写为 './config.ts'（平铺目录）。
// 用法：node tests/prepare-opening.mjs && node --test tests/introVideos.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '.build-opening');

const COPIES = [
  [path.resolve(here, '../src/Counterfeit/界面/开场白/introVideos.ts'), 'introVideos.ts'],
  [path.resolve(here, '../src/Counterfeit/config.ts'), 'config.ts'],
];

function rewrite(text) {
  text = text.replace(/(['"])\.\.\/\.\.\/config\1/g, "'./config.ts'");
  text = text.replace(
    /(import\s+(?:[^'"]*\s+from\s+)?)(['"])(\.\.?\/[^'"]+)(['"])/g,
    (_m, pre, q1, spec, q2) => `${pre}${q1}${spec.endsWith('.ts') || spec.endsWith('.js') ? spec : `${spec}.ts`}${q2}`,
  );
  return text;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [src, name] of COPIES) {
  fs.writeFileSync(path.join(outDir, name), rewrite(fs.readFileSync(src, 'utf8')));
}
console.log(`[tests/prepare-opening] ${COPIES.length} 个模块副本已生成`);
```

- [ ] **Step 2: 写失败测试**

```ts
// 前端工程/tests/introVideos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_CLIPS,
  TITLE_LOOP,
  pickVariant,
  clipVideoUrl,
  clipPosterUrl,
  titleLoopVideoUrl,
  titleLoopPosterUrl,
} from './.build-opening/introVideos.ts';

test('序奏六拍：key 顺序与分镜脚本一致', () => {
  assert.deepEqual(
    INTRO_CLIPS.map(c => c.key),
    ['may', 'spring', 'summer', 'winter', 'heal', 'grad'],
  );
});

test('每拍 5s，且有中文字幕日期标注', () => {
  for (const clip of INTRO_CLIPS) {
    assert.equal(clip.durationMs, 5000, clip.key);
    assert.ok(clip.dateLabel.length > 0, clip.key);
  }
});

test('画幅选源：竖屏 _v，横屏/方形 _h', () => {
  assert.equal(pickVariant(390, 844), 'v');
  assert.equal(pickVariant(1920, 1080), 'h');
  assert.equal(pickVariant(1000, 1000), 'h');
});

test('视频/首帧 URL：文件名带画幅后缀，附版本号', () => {
  const url = clipVideoUrl(INTRO_CLIPS[0], 'v');
  assert.match(url, /intro_01_may_v\.mp4\?v=/);
  const poster = clipPosterUrl(INTRO_CLIPS[2], 'h');
  assert.match(poster, /intro_03_summer_h\.webp\?v=/);
});

test('标题屏循环 URL', () => {
  assert.match(titleLoopVideoUrl('v'), /title_sakura_loop_v\.mp4\?v=/);
  assert.match(titleLoopPosterUrl(), /bg_sakura\.webp\?v=/);
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd 前端工程 && node tests/prepare-opening.mjs && node --test tests/introVideos.test.ts`
Expected: FAIL —— `Cannot find module './.build-opening/introVideos.ts'`（prepare 脚本报 ENOENT，因为 introVideos.ts 还没创建）

- [ ] **Step 4: 实现 introVideos.ts**

```ts
// 前端工程/src/Counterfeit/界面/开场白/introVideos.ts
import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** 视频化序奏播放清单（2026-08-27 三版：Seedance 图生视频，替代静态 CG 运镜 introAssets.ts） */

export type Variant = 'v' | 'h'; // v = 9:16 竖版，h = 16:9 横版

export interface IntroClip {
  /** 程序标识（勿改，测试依赖顺序） */
  key: 'may' | 'spring' | 'summer' | 'winter' | 'heal' | 'grad';
  /** 文件基名（assets 下 <base>_<variant>.mp4 / .webp） */
  base: string;
  /** 左下角字幕·手写体日期行（DOM 叠加，不烧进视频） */
  dateLabel: string;
  /** 停留时长 ms（与视频一致，poster 降级时用它定时切拍） */
  durationMs: number;
}

export const INTRO_CLIPS: IntroClip[] = [
  { key: 'may',    base: 'intro_01_may',    dateLabel: '五月二十日',   durationMs: 5000 },
  { key: 'spring', base: 'intro_02_spring', dateLabel: '春 · 相遇',    durationMs: 5000 },
  { key: 'summer', base: 'intro_03_summer', dateLabel: '夏 · 海边',    durationMs: 5000 },
  { key: 'winter', base: 'intro_04_winter', dateLabel: '十二月二十四日', durationMs: 5000 },
  { key: 'heal',   base: 'intro_05_heal',   dateLabel: '冬末',         durationMs: 5000 },
  { key: 'grad',   base: 'intro_06_grad',   dateLabel: '春 · 卒業',    durationMs: 5000 },
];

export const TITLE_LOOP_BASE = 'title_sakura_loop';

/** 画幅选源：序奏开始时按视口一次选定，中途不随旋转切换。方形按横版处理。 */
export function pickVariant(w: number, h: number): Variant {
  return h > w ? 'v' : 'h';
}

function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}

export function clipVideoUrl(clip: IntroClip, variant: Variant): string {
  return assetUrl(`${clip.base}_${variant}.mp4`);
}

/** 首帧静态图：兼作 video poster 与降级图 */
export function clipPosterUrl(clip: IntroClip, variant: Variant): string {
  return assetUrl(`${clip.base}_${variant}.webp`);
}

export function titleLoopVideoUrl(variant: Variant): string {
  return assetUrl(`${TITLE_LOOP_BASE}_${variant}.mp4`);
}

/** 标题屏 poster 复用现有静态樱花图 */
export function titleLoopPosterUrl(): string {
  return assetUrl('bg_sakura.webp');
}

/** 启动门等待期间预载：第 1 拍视频 + 标题屏循环（其余各拍播放中后台预取） */
export function preloadOpeningAssets(variant: Variant): void {
  for (const src of [clipVideoUrl(INTRO_CLIPS[0], variant), titleLoopVideoUrl(variant)]) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = src;
    video.load();
  }
}

/** 播放中预取下一拍（浏览器按缓存策略处理，重复调用无害） */
export function prefetchClip(index: number, variant: Variant): void {
  const clip = INTRO_CLIPS[index];
  if (!clip) return;
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = clipVideoUrl(clip, variant);
  video.load();
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd 前端工程 && node tests/prepare-opening.mjs && node --test tests/introVideos.test.ts`
Expected: PASS（5 个测试全过）

- [ ] **Step 6: 构建确认类型无误**

Run: `cd 前端工程 && npm run build`
Expected: 构建成功（此时 IntroSequence.vue 还没改，不引用新模块，构建应不受影响）

- [ ] **Step 7: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/开场白/introVideos.ts 前端工程/tests/introVideos.test.ts 前端工程/tests/prepare-opening.mjs
git commit -m "feat(opening): add video playlist module for Seedance intro"
```

---

### Task 2: IntroSequence.vue 重写为视频播放器

**Files:**
- Modify: `前端工程/src/Counterfeit/界面/开场白/IntroSequence.vue`（整体重写）

行为契约（对应 spec「前端改造」2/3/5/6 条）：
- 双 `<video>` 层交替播放，`ended` 切拍，CSS 交叉叠化 400ms
- 左下角字幕（dateLabel），随拍切换
- 单条加载失败 → 该层换 `<img>` 首帧静态图，用 `durationMs` 定时切拍；6 拍全失败 → 直接 `store.toTitle()`
- 点击跳过 / 播完 → 白幕（复用 outro-veil）→ `store.toTitle()`
- 保留调试参数 `?screen=intro&from=N`
- `object-fit: cover` 满屏；`playsinline` + `muted`（无声视频，iOS 自动播放要求）

- [ ] **Step 1: 整体重写组件**

```vue
<!-- 前端工程/src/Counterfeit/界面/开场白/IntroSequence.vue -->
<template>
  <div class="intro-screen" @click="skip">
    <TransitionGroup name="layer">
      <div v-for="layer in layers" :key="layer.id" class="frame-layer">
        <!-- poster 降级：视频加载失败时该拍显示首帧静态图 -->
        <img
          v-if="layer.failed"
          class="clip-media"
          :src="clipPosterUrl(layer.clip, variant)"
          alt="序奏 CG"
          draggable="false"
        />
        <video
          v-else
          class="clip-media"
          :src="clipVideoUrl(layer.clip, variant)"
          :poster="clipPosterUrl(layer.clip, variant)"
          muted
          playsinline
          preload="auto"
          @ended="advance"
          @error="onClipError(layer.id)"
        ></video>
      </div>
    </TransitionGroup>

    <Transition name="caption">
      <p v-if="currentLabel" :key="currentLabel" class="date-caption">{{ currentLabel }}</p>
    </Transition>

    <span class="skip-hint"><i class="fa-solid fa-forward"></i> 点击屏幕跳过</span>
    <div class="outro-veil" :class="{ 'is-on': finishing }" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import {
  INTRO_CLIPS,
  clipPosterUrl,
  clipVideoUrl,
  pickVariant,
  prefetchClip,
  type IntroClip,
  type Variant,
} from './introVideos';
import { useOpeningStore } from './store';

const store = useOpeningStore();

interface Layer {
  id: number;
  clip: IntroClip;
  /** 视频加载失败 → 改用 poster 静态图 + 定时切拍 */
  failed?: boolean;
}

/** 画幅序奏开始时一次选定，中途不随旋转切换 */
const variant: Variant = pickVariant(window.innerWidth, window.innerHeight);

const layers = ref<Layer[]>([]);
const finishing = ref(false);
const currentLabel = ref('');
let uid = 0;
let current = 0;
let failCount = 0;
let timer: number | undefined;

function play(index: number) {
  if (index >= INTRO_CLIPS.length) {
    finish();
    return;
  }
  current = index;
  const clip = INTRO_CLIPS[index];
  layers.value.push({ id: uid++, clip });
  currentLabel.value = clip.dateLabel;
  // 只保留最近两层（叠化期间新旧共存）
  if (layers.value.length > 2) {
    layers.value = layers.value.slice(-2);
  }
  prefetchClip(index + 1, variant);
  const el = latestVideo();
  if (el) {
    el.play().catch(() => onClipError(layers.value[layers.value.length - 1].id));
  }
}

/** 取最新一层的 video 元素（failed 层为 img，返回 null） */
function latestVideo(): HTMLVideoElement | null {
  const nodes = document.querySelectorAll<HTMLVideoElement>('.frame-layer video');
  return nodes.length ? nodes[nodes.length - 1] : null;
}

function advance() {
  window.clearTimeout(timer);
  play(current + 1);
}

function onClipError(layerId: number) {
  const layer = layers.value.find(l => l.id === layerId);
  if (!layer || layer.failed) return;
  layer.failed = true;
  failCount += 1;
  if (failCount >= INTRO_CLIPS.length) {
    // 全灭：序奏播不了，直接进标题屏
    store.toTitle();
    return;
  }
  // 静态图没有 ended 事件，按拍时长定时切
  window.clearTimeout(timer);
  timer = window.setTimeout(advance, layer.clip.durationMs);
}

function skip() {
  finish();
}

/** 收束：白幕淡入 → 交还标题屏（BGM 不停，继续播） */
function finish() {
  if (finishing.value) return;
  finishing.value = true;
  window.clearTimeout(timer);
  for (const el of document.querySelectorAll<HTMLVideoElement>('.frame-layer video')) {
    el.pause();
  }
  window.setTimeout(() => store.toTitle(), 620);
}

onMounted(() => {
  // 调试：?screen=intro&from=N 从第 N 拍开始
  const from = Number(new URLSearchParams(window.location.search).get('from') ?? 0);
  const start = Number.isInteger(from) && from >= 0 && from < INTRO_CLIPS.length ? from : 0;
  play(start);
});

onUnmounted(() => {
  window.clearTimeout(timer);
});
</script>

<style lang="scss" scoped>
.intro-screen {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: #0c0a10;
  cursor: pointer;
  user-select: none;
}

.frame-layer {
  position: absolute;
  inset: 0;
}

.clip-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 拍间交叉叠化 400ms */
.layer-enter-active,
.layer-leave-active {
  transition: opacity 0.4s ease;
}

.layer-enter-from,
.layer-leave-to {
  opacity: 0;
}

/* 左下角字幕·手写体日期行 */
.date-caption {
  position: absolute;
  left: 22px;
  bottom: 34px;
  z-index: 4;
  font-family: var(--font-title);
  font-size: clamp(15px, 2.4vw, 22px);
  letter-spacing: 6px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.caption-enter-active {
  transition: opacity 0.5s ease 0.2s;
}

.caption-leave-active {
  transition: opacity 0.2s ease;
}

.caption-enter-from,
.caption-leave-to {
  opacity: 0;
}

.skip-hint {
  position: absolute;
  right: 18px;
  bottom: 16px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.5);
  animation: hint-in 0.8s ease 1.2s both;
}

@keyframes hint-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 收束白幕：序奏结束 → 白场 → 标题屏 */
.outro-veil {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: #fdfdfe;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;

  &.is-on {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .layer-enter-active,
  .layer-leave-active {
    transition: none;
  }
}
</style>
```

注意：`ref`/`onMounted`/`onUnmounted` 靠 unplugin-auto-import 自动注入（与旧组件一致，无需 import）。

- [ ] **Step 2: 构建 + lint**

Run: `cd 前端工程 && npm run build && npx eslint "src/Counterfeit/界面/开场白/IntroSequence.vue"`
Expected: 构建成功、lint 无 error（此时 GateScreen 仍引用 introAssets.ts，未删，构建应通过）

- [ ] **Step 3: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/开场白/IntroSequence.vue
git commit -m "feat(opening): rewrite intro sequence as crossfading video player"
```

---

### Task 3: GateScreen 预载切换 + 删除 introAssets.ts

**Files:**
- Modify: `前端工程/src/Counterfeit/界面/开场白/GateScreen.vue:23,29-32`
- Delete: `前端工程/src/Counterfeit/界面/开场白/introAssets.ts`

- [ ] **Step 1: 改 GateScreen.vue**

import 行替换：

```ts
// 旧：import { preloadIntroAssets } from './introAssets';
import { pickVariant, preloadOpeningAssets } from './introVideos';
```

onMounted 块替换：

```ts
// 等待点击期间预载第 1 拍视频 + 标题屏循环，避免序奏中途卡
onMounted(() => {
  preloadOpeningAssets(pickVariant(window.innerWidth, window.innerHeight));
});
```

- [ ] **Step 2: 确认无残留引用后删除 introAssets.ts**

Run: `cd 前端工程 && grep -rn "introAssets" src/`
Expected: 无任何输出（若有残留引用，先改完再删）

```bash
git rm 前端工程/src/Counterfeit/界面/开场白/introAssets.ts
```

- [ ] **Step 3: 构建 + lint**

Run: `cd 前端工程 && npm run build && npx eslint "src/Counterfeit/界面/开场白/GateScreen.vue"`
Expected: 构建成功、lint 无 error

- [ ] **Step 4: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/开场白/GateScreen.vue
git commit -m "feat(opening): preload video assets at gate, drop static frame module"
```

---

### Task 4: TitleScreen 背景动态化

**Files:**
- Modify: `前端工程/src/Counterfeit/界面/开场白/TitleScreen.vue:4`

策略：保留现有 `<img class="bg-tree">` 作底层兜底；其上叠 `<video>`，`canplay` 后淡入，`error` 则保持隐藏（静图兜底永续）。循环视频无声，`muted loop autoplay playsinline`。

- [ ] **Step 1: 模板改动**

第 4 行 `<img class="bg-tree" ...>` 保留不动，在其后插入：

```vue
    <video
      class="bg-tree bg-tree-video"
      :class="{ 'is-ready': bgVideoReady }"
      :src="titleLoopVideoUrl(titleVariant)"
      :poster="titleLoopPosterUrl()"
      muted
      loop
      autoplay
      playsinline
      preload="auto"
      aria-hidden="true"
      @canplay="bgVideoReady = true"
      @error="bgVideoReady = false"
    ></video>
```

- [ ] **Step 2: script 改动**

import 区加：

```ts
import { pickVariant, titleLoopPosterUrl, titleLoopVideoUrl } from './introVideos';
```

setup 顶部（`const store = useOpeningStore();` 之后）加：

```ts
// 标题屏背景循环视频：画幅一次性选定；加载失败时静图兜底（bg-tree <img> 始终在底层）
const titleVariant = pickVariant(window.innerWidth, window.innerHeight);
const bgVideoReady = ref(false);
```

- [ ] **Step 3: style 追加（组件 `<style>` 内，`.bg-tree` 规则之后）**

```scss
.bg-tree-video {
  opacity: 0;
  transition: opacity 0.8s ease;

  &.is-ready {
    opacity: 1;
  }
}
```

注意：`.bg-tree-video` 复用 `.bg-tree` 的定位/尺寸规则，仅叠加淡入。若现有 `.bg-tree` 用的是 `object-fit: contain` 或带滤镜，确认 video 同样继承——不一致就以 `.bg-tree` 为准补齐 `object-fit: cover` 以外的同名属性。

- [ ] **Step 4: 构建 + lint**

Run: `cd 前端工程 && npm run build && npx eslint "src/Counterfeit/界面/开场白/TitleScreen.vue"`
Expected: 构建成功、lint 无 error

- [ ] **Step 5: Commit**

```bash
git add 前端工程/src/Counterfeit/界面/开场白/TitleScreen.vue
git commit -m "feat(opening): animated sakura loop background on title screen"
```

---

### Task 5: 无素材状态下的降级 QA（断网链路验证）

**Files:** 无新增（纯验证）

此时代码已完整，但 14 个视频/首帧文件尚未生成——正好是验证降级链的最佳时机（所有视频 404）。

- [ ] **Step 1: 本地起静态服务并按 config.ts 注释切换本地素材路径**

`前端工程/src/Counterfeit/config.ts:4` 的 `ASSET_BASE` 临时改为相对路径（验证完必须改回，下一步提交前 `git diff` 确认）：

```ts
// 临时（仅本地验证，勿提交）：
export const ASSET_BASE = '/assets/Counterfeit/开场白';
```

以仓库根目录为 webroot 起静态服务器（端口 5500），打开 `前端工程/dist/Counterfeit/界面/开场白/index.html` 对应页面（需先 `npm run build`）。

- [ ] **Step 2: 验证全灭降级**

Expected: 启动门点击 → 所有视频 404 → 直接进入标题屏（无卡死、无黑屏长留）；标题屏静图樱花背景正常显示（bg-tree img 兜底）。

- [ ] **Step 3: 验证单拍降级**

在 `assets/Counterfeit/开场白/` 放一张占位图 `intro_01_may_v.webp`（任意图片改名即可）并刷新。

Expected: 第 1 拍视频 404 → 显示该静态图 5s → 后续拍继续失败 → 进标题屏；字幕「五月二十日」出现。

- [ ] **Step 4: 恢复 config.ts 并提交（无代码改动时不提交）**

```bash
cd 前端工程 && git checkout -- src/Counterfeit/config.ts
```

Run: `git status --short`
Expected: 工作区干净（本任务纯验证，无提交）

---

### Task 6: 素材生成提示词文档（用户在外部执行）

**Files:**
- Create: `docs/opening/2026-08-27-seedance-prompts.md`

把分镜脚本落成可直接粘贴的生成提示词。首帧用图像模型生成（画风对齐画廊现有场景 CG），再喂 Seedance 图生视频。每拍竖横两版首帧；标题循环首帧直接复用现有 `bg_sakura.webp`（横版另需一张 16:9 樱花图）。

文档内容：

```markdown
# 开场白视频素材生成提示词（2026-08-27）

## 通用约束

- 首帧：二次元动画画风，赛璐璐上色，柔和光影，与《我的青春恋爱物语果然有问题》同人 CG 一致
- 角色帧（拍 2/3/6）必须附参考图：hachiman.webp / yukino.webp / yui.webp / laff.webp 立绘
- 画幅：竖版 9:16（720×1280），横版 16:9（1280×720）
- Seedance：5s、720p、无声；运镜幅度一律「缓慢」，避免人物帧大幅运动导致脸部崩坏
- 拉芙希妮特征：金色长发、右手腕尾端烧焦的旧丝带（拍 4/5 为特写道具，其余拍仅作角色固有外观）

## 拍 1 · 五月空镜（intro_01_may）

首帧：总武高中特别栋走廊，午后逆光，敞开的窗户，白色窗帘鼓起，
樱花瓣飘入无人的空教室，课桌椅剪影，暖金色空气感。无人物。
运动：镜头缓慢前推，樱花瓣持续飘落，窗帘轻轻摆动，光线微尘浮动。

## 拍 2 · 春·相遇（intro_02_spring）

首帧：学校部室，门推开一半。靠窗座位雪之下雪乃（黑长直、蓝色缎带）捧书阅读；
门口站着拉芙希妮（金发、右手腕烧焦丝带）正要进来；由比滨结衣（粉色团子头）
从拉芙肩后探头；比企谷八幡（死鱼眼）抱臂坐在角落。午后柔光，日常感。
运动：镜头从门框边缘缓慢横移 reveal 室内，人物基本静止（眨眼/翻页级别微动）。

## 拍 3 · 夏·海边自拍（intro_03_summer）

首帧：黄昏海边，橘粉色天空，结衣举起手机自拍，四人挤进取景框：
结衣在前举机，雪乃被拉得微微前倾，八幡一脸不情愿站在边上，
拉芙笑着比耶。海风扬起头发和裙摆。
运动：轻微手持晃动感，头发与衣物被海风吹动，结尾一帧快门白闪。

## 拍 4 · 冬·已读（intro_04_winter）

首帧：雪夜室内特写，一只手握着手机，屏幕冷光照亮指尖，
聊天界面停留在「已读」二字（界面可模糊化处理）；
背景窗玻璃上凝结的雪花，室外漆黑。整体冷蓝色调，孤独感。无正脸。
运动：固定机位，窗外雪落，屏幕光缓慢变暗至熄屏。

## 拍 5 · 冬末·炉火信物（intro_05_heal）

首帧：暖炉前的矮桌特写：一把黄铜钥匙、一条尾端烧焦后重新系好的旧丝带
并排放在木桌上，炉火暖橙色光晕映照，背景虚化的房间轮廓。无人物。
运动：火光轻轻摇曳，镜头缓慢推向桌面上的钥匙与丝带。

## 拍 6 · 春·毕业收束（intro_06_grad）

首帧：樱花树下四人并排站立的全身合影，仰视稍低机位，
满开樱花，湛蓝天空，四人笑容（八幡嘴角微扬级别）。
构图上留头顶空间，与标题屏樱花树构图呼应。
运动：镜头轻微拉远，樱花瓣掠过画面前景，结尾画面渐白。

## 标题屏循环（title_sakura_loop）

竖版首帧：复用 assets/Counterfeit/开场白/bg_sakura.webp。
横版首帧：按 bg_sakura.webp 同构图重绘 16:9 版（白底、动漫插画樱花树、留白给标题文字）。
运动：樱花花瓣持续缓慢飘落，树枝极轻微摆动。
⚠️ 必须勾选/构造首尾帧一致的可循环视频（首帧=尾帧），循环点不可见。
```

- [ ] **Step 1: 写文档并提交**

```bash
git add docs/opening/2026-08-27-seedance-prompts.md
git commit -m "docs: Seedance generation prompts for opening video assets"
```

- [ ] **Step 2: 用户在外部执行生成（人工卡点）**

按文档生成 14 张首帧 + 14 条视频。验收标准：脸部与立绘参考一致、丝带只在拍 4/5 特写、竖版构图无裁头、循环视频首尾无跳变。**此步骤完成前不要进 Task 8。**

---

### Task 7: 横版超分工具脚本

**Files:**
- Create: `前端工程/assets/tools/upscale_opening_videos.py`

依赖：`realesrgan-ncnn-vulkan`（Real-ESRGAN anime 模型 `realesr-animevideov3`）与 `ffmpeg` 在 PATH。仅处理 `_h.mp4`（横版）；竖版 720p 直出不超分。

```python
# -*- coding: utf-8 -*-
"""开场白横版视频超分：720p → 1080p（Real-ESRGAN anime 模型 + ffmpeg 逐帧管线）。

用法：python assets/tools/upscale_opening_videos.py <输入目录> <输出目录>
输入目录放 Seedance 直出的 *_h.mp4（1280×720）；输出为 1920×1080、无声、CRF 20。
"""
import os
import subprocess
import sys
import tempfile

FPS_PROBE = ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0']


def run(cmd):
    subprocess.run(cmd, check=True)


def upscale(src, dst):
    with tempfile.TemporaryDirectory() as tmp:
        frames_in = os.path.join(tmp, 'in')
        frames_out = os.path.join(tmp, 'out')
        os.makedirs(frames_in)
        os.makedirs(frames_out)
        fps = subprocess.run(FPS_PROBE + [src], capture_output=True, text=True, check=True).stdout.strip()
        run(['ffmpeg', '-y', '-i', src, os.path.join(frames_in, 'f%06d.png')])
        run(['realesrgan-ncnn-vulkan', '-i', frames_in, '-o', frames_out,
             '-n', 'realesr-animevideov3', '-s', '2', '-f', 'png'])
        # 720p ×2 = 1440p，再缩到 1080p（比直接 ×1.5 画质更稳）
        run(['ffmpeg', '-y', '-framerate', fps, '-i', os.path.join(frames_out, 'f%06d.png'),
             '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264',
             '-crf', '20', '-pix_fmt', 'yuv420p', '-an', dst])


def main():
    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    os.makedirs(dst_dir, exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if name.endswith('_h.mp4'):
            print(f'超分: {name}')
            upscale(os.path.join(src_dir, name), os.path.join(dst_dir, name))
            print(f'  -> {os.path.getsize(os.path.join(dst_dir, name)) // 1024}KB')


if __name__ == '__main__':
    main()
```

- [ ] **Step 1: 写脚本并用一条样片验证**

Run: `cd 前端工程 && python assets/tools/upscale_opening_videos.py <样片目录> <输出目录>`
Expected: 输出 1920×1080 mp4，体积 ≤3.5MB/条，播放无花屏

- [ ] **Step 2: Commit**

```bash
git add 前端工程/assets/tools/upscale_opening_videos.py
git commit -m "tools: Real-ESRGAN upscale pipeline for landscape opening videos"
```

---

### Task 8: 素材入库 + 版本号 + 全量 QA

**Files:**
- Create: `前端工程/assets/Counterfeit/开场白/intro_0*_*.mp4`、`intro_0*_*.webp`、`title_sakura_loop_*.mp4`（14 视频 + 14 首帧，其中 title 竖版首帧复用现有 bg_sakura.webp 不重复入库）
- Modify: `前端工程/src/Counterfeit/config.ts:16`（ASSET_VERSION bump）
- Move: 旧 `intro_group/trauma/token/selfie/animals.webp` → `图片素材/新开场白/`（沿用 import_opening_v2_assets.py 的备份惯例；该目录在仓库外，手动移动即可，不进 git）

- [ ] **Step 1: 素材落位**

命名严格匹配 Task 1 的 `base` + `_v/_h` 规则：`intro_01_may_v.mp4` / `intro_01_may_h.mp4` / `intro_01_may_v.webp` … `title_sakura_loop_v.mp4` / `title_sakura_loop_h.mp4`。竖版 mp4 为 Seedance 720p 直出；横版 mp4 用 Task 7 脚本超分后产物。

Run: `ls 前端工程/assets/Counterfeit/开场白/ | grep -c "intro_0"`
Expected: 24（6 拍 × 2 画幅 × 视频+首帧）

- [ ] **Step 2: bump ASSET_VERSION**

`前端工程/src/Counterfeit/config.ts:16`：

```ts
export const ASSET_VERSION = '20260827a';
```

- [ ] **Step 3: 构建 + 全量 QA（本地素材路径临时切换法同 Task 5 Step 1）**

桌面（横版源）与设备模拟竖屏（竖版源）各跑一遍完整流程。Checklist：
- 启动门点击 → BGM 起 → 拍 1 视频播放（非 poster）
- 六拍顺序正确、字幕日期随拍切换、叠化无跳黑
- 拍 6 → 白场 → 标题屏，循环视频樱花飘落、循环点无跳变
- 跳过按钮任何时刻可用
- 单条视频改名模拟 404 → 该拍出静态首帧 5s 后继续

- [ ] **Step 4: 恢复 config.ts 的 CDN 路径（保留新版本号），提交**

```bash
git add 前端工程/assets/Counterfeit/开场白 前端工程/src/Counterfeit/config.ts
git commit -m "assets: Seedance opening videos + first-frame posters, bump asset version"
```

- [ ] **Step 5: 推送素材仓库并更新 ASSET_BASE 固定 commit（人工卡点）**

assets 通过 GitHub 仓库 `qmsdaa/tavern_helper_template` + jsDelivr 分发（见 config.ts 注释）。推送后取新 commit hash 更新 `ASSET_BASE`，再 bump 一次 `ASSET_VERSION` 并提交。注意 config.ts:9 的警告：原仓库已超 jsDelivr 体积上限，若 14 条视频推送后 jsDelivr 不解析新 commit，需按注释把开场白素材迁到 `tavern_helper_template_cdn` 仓库——这是已知预案，不算阻塞。

---

## Self-Review 记录

- **Spec 覆盖：** 六拍分镜→Task 1 数据 + Task 6 提示词；双画幅→pickVariant + 命名规则；降级链→Task 2 onClipError + Task 5 QA；标题屏→Task 4；超分→Task 7；版本/CDN→Task 8。覆盖完整。
- **类型一致性：** `pickVariant`/`clipVideoUrl`/`clipPosterUrl`/`titleLoopVideoUrl`/`titleLoopPosterUrl`/`preloadOpeningAssets`/`prefetchClip` 在 Task 1 定义，Task 2/3/4 引用一致；`Variant` 类型一致。
- **已知取舍：** Task 2 用 `document.querySelectorAll` 取 video 元素而非模板 ref（TransitionGroup 动态层下 ref 管理更脆）；UI 组件无单测（仓库无设施，YAGNI）。
