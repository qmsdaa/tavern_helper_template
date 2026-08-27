<template>
  <div class="intro-screen" ref="root" @click="skip">
    <TransitionGroup name="layer">
      <div v-for="layer in layers" :key="layer.id" class="frame-layer" :data-layer-id="layer.id">
        <!-- poster 降级：视频加载失败时该拍显示首帧静态图 -->
        <img
          v-if="layer.failed"
          class="clip-media"
          :src="clipPosterUrl(layer.clip)"
          alt="序奏 CG"
          draggable="false"
        />
        <video
          v-else
          class="clip-media"
          :src="clipVideoUrl(layer.clip)"
          :poster="clipPosterUrl(layer.clip)"
          muted
          playsinline
          preload="auto"
          @ended="advance"
          @error="onClipError(layer.id)"
        ></video>
      </div>
    </TransitionGroup>

    <Transition name="caption">
      <p v-if="currentLabel" :key="captionKey" class="date-caption">{{ currentLabel }}</p>
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
  prefetchClip,
  type IntroClip,
} from './introVideos';
import { useOpeningStore } from './store';

const store = useOpeningStore();

interface Layer {
  id: number;
  clip: IntroClip;
  /** 视频加载失败 → 改用 poster 静态图 + 定时切拍 */
  failed?: boolean;
}

const layers = ref<Layer[]>([]);
const finishing = ref(false);
const currentLabel = ref('');
/** 字幕过渡 key：用层 id 保证相邻拍 dateLabel 相同时也会重新触发 */
const captionKey = ref(0);
let uid = 0;
let current = 0;
let failCount = 0;
let timer: number | undefined;
let finishTimer: number | undefined;
/** 组件根节点：DOM 查询限定在组件内，避免误触其他实例 */
const root = ref<HTMLElement | null>(null);

async function play(index: number) {
  if (finishing.value) return;
  if (index >= INTRO_CLIPS.length) {
    finish();
    return;
  }
  current = index;
  const clip = INTRO_CLIPS[index];
  const layer: Layer = { id: uid++, clip };
  layers.value.push(layer);
  currentLabel.value = clip.dateLabel;
  captionKey.value = layer.id;
  // 只保留最近两层（叠化期间新旧共存）
  if (layers.value.length > 2) {
    layers.value = layers.value.slice(-2);
  }
  prefetchClip(index + 1);
  // Vue 异步渲染：等 DOM 更新后才能拿到新挂载的 <video>
  await nextTick();
  const el = layerVideo(layer.id);
  if (el) {
    el.play().catch(() => onClipError(layer.id));
  }
}

/** 按层 id 精确取该层的 video 元素（failed 层为 img，返回 null） */
function layerVideo(layerId: number): HTMLVideoElement | null {
  return root.value?.querySelector<HTMLVideoElement>(`.frame-layer[data-layer-id="${layerId}"] video`) ?? null;
}

function advance() {
  if (finishing.value) return;
  window.clearTimeout(timer);
  void play(current + 1);
}

function onClipError(layerId: number) {
  if (finishing.value) return;
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
  pauseAll();
  finishTimer = window.setTimeout(() => store.toTitle(), 620);
}

function pauseAll() {
  for (const el of root.value?.querySelectorAll<HTMLVideoElement>('.frame-layer video') ?? []) {
    el.pause();
  }
}

onMounted(() => {
  // 调试：?screen=intro&from=N 从第 N 拍开始
  const from = Number(new URLSearchParams(window.location.search).get('from') ?? 0);
  const start = Number.isInteger(from) && from >= 0 && from < INTRO_CLIPS.length ? from : 0;
  play(start);
});

onUnmounted(() => {
  window.clearTimeout(timer);
  window.clearTimeout(finishTimer);
  pauseAll();
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
