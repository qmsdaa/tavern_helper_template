<template>
  <div class="intro-screen" @click="skip">
    <TransitionGroup name="layer">
      <div v-for="layer in layers" :key="layer.id" class="frame-layer" :class="{ 'is-healing': layer.healing }">
        <!-- 面部特写推镜（有 focus 的帧）：镜头向该角色脸部推进 -->
        <img
          v-if="layer.frame.focus && !reduced"
          class="closeup-img"
          :src="url(layer.frame.image)"
          :style="closeupStyle(layer.frame)"
          alt="序奏 CG"
          draggable="false"
        />

        <!-- 完整图（群像/四宫格/自拍）：竖屏 contain + 同源模糊图填空边 -->
        <div v-else class="full-wrap" :class="{ 'is-converge': !reduced && layer.frame.full }">
          <img class="full-fill" :src="url(layer.frame.image)" alt="" aria-hidden="true" draggable="false" />
          <img class="full-img" :src="url(layer.frame.image)" alt="序奏 CG" draggable="false" />
          <!-- 「走出创伤」转场：推近暖光点时渐白 -->
          <div v-if="layer.frame.transitionOut === 'heal'" class="heal-veil" aria-hidden="true"></div>
        </div>
      </div>
    </TransitionGroup>

    <span class="skip-hint"><i class="fa-solid fa-forward"></i> 点击屏幕跳过</span>
    <div class="outro-veil" :class="{ 'is-on': finishing }" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { HEAL_DURATION, INTRO_FRAMES, introAssetUrl, type IntroFrame } from './introAssets';
import { useOpeningStore } from './store';

const store = useOpeningStore();
const url = introAssetUrl;

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface Layer {
  id: number;
  frame: IntroFrame;
  /** 「走出创伤」长转场进行中（当前层推近暖光点 + 渐白） */
  healing?: boolean;
}

const layers = ref<Layer[]>([]);
const finishing = ref(false);
let uid = 0;
let timer: number | undefined;

/** 视口尺寸（特写推镜的像素级 cover 计算用） */
const viewport = reactive({ w: window.innerWidth, h: window.innerHeight });
function onResize() {
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
}

/**
 * 特写推镜：显式像素尺寸 cover 视口（不用 object-fit，transform-origin 百分比才能精确映射源图坐标）。
 * 先 translate 把焦点移到屏幕中心，再以焦点为原点 scale 推进（0.92z → z），镜头始终对准该角色的脸。
 */
function closeupStyle(frame: IntroFrame) {
  const h = Math.max(viewport.h, viewport.w / frame.ratio);
  const w = h * frame.ratio;
  const [fx, fy] = frame.focus ?? [0.5, 0.5];
  const zoom = frame.zoom ?? 2;
  const base = `translate(-50%, -50%) translate(${(0.5 - fx) * 100}%, ${(0.5 - fy) * 100}%)`;
  return {
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: `${fx * 100}% ${fy * 100}%`,
    '--kb-from': `${base} scale(${zoom * 0.92})`,
    '--kb-to': `${base} scale(${zoom})`,
    animationDuration: `${frame.duration + 500}ms`,
  };
}

function schedule(index: number) {
  timer = window.setTimeout(() => advance(index), INTRO_FRAMES[index].duration);
}

function advance(index: number) {
  const next = index + 1;
  if (next >= INTRO_FRAMES.length) {
    finish();
    return;
  }
  // 「走出创伤」长转场：当前层先播 2.8s 推近+渐白，再进下一帧（减弱动态下跳过，直接交叉淡入）
  if (INTRO_FRAMES[index].transitionOut === 'heal' && !reduced) {
    const current = layers.value[layers.value.length - 1];
    if (current) {
      current.healing = true;
    }
    timer = window.setTimeout(() => pushNext(next), HEAL_DURATION);
    return;
  }
  pushNext(next);
}

function pushNext(next: number) {
  layers.value.push({ id: uid++, frame: INTRO_FRAMES[next] });
  const oldId = layers.value[0]?.id;
  window.setTimeout(() => {
    layers.value = layers.value.filter(layer => layer.id !== oldId);
  }, 350);
  schedule(next);
}

function skip() {
  finish();
}

/** 收束：白幕淡入 → 交还标题屏（BGM 不停，继续播） */
function finish() {
  if (finishing.value) {
    return;
  }
  finishing.value = true;
  window.clearTimeout(timer);
  window.setTimeout(() => store.toTitle(), 620);
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  // 调试：?screen=intro&from=N 从第 N 帧开始（验证转场时序用）
  const from = Number(new URLSearchParams(window.location.search).get('from') ?? 0);
  const start = Number.isInteger(from) && from >= 0 && from < INTRO_FRAMES.length ? from : 0;
  layers.value.push({ id: uid++, frame: INTRO_FRAMES[start] });
  schedule(start);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
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

.layer-enter-active {
  transition: opacity 0.2s ease;
}

.layer-leave-active {
  transition: opacity 0.3s ease;
}

.layer-enter-from,
.layer-leave-to {
  opacity: 0;
}

/* —— 面部特写推镜 —— */

.closeup-img {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: none;
  animation-name: kb-push;
  animation-timing-function: cubic-bezier(0.25, 0.6, 0.35, 1);
  animation-fill-mode: both;
}

@keyframes kb-push {
  from {
    transform: var(--kb-from);
  }
  to {
    transform: var(--kb-to);
  }
}

/* —— 完整图 —— */

.full-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0c0a10;

  /* 收束帧：虹膜展开（⑤⑥⑧） */
  &.is-converge {
    animation: converge 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}

@keyframes converge {
  from {
    clip-path: circle(7% at 50% 50%);
  }
  to {
    clip-path: circle(142% at 50% 50%);
  }
}

.full-img {
  position: relative;
  width: 100%;
  height: 100%;
  /* 竖屏可读性优先：整图 contain（四宫格必须读全），空边由 .full-fill 模糊同源图填充 */
  object-fit: contain;
  animation: full-settle 2.4s ease-out both;
}

@keyframes full-settle {
  from {
    transform: scale(1.06);
  }
  to {
    transform: scale(1);
  }
}

/* 空边填充：同源模糊放大副本 */
.full-fill {
  position: absolute;
  inset: -6%;
  width: 112%;
  height: 112%;
  object-fit: cover;
  filter: blur(34px) brightness(0.42);
}

/* —— 「走出创伤」长转场：推近右下角玩具熊的暖光点，画面渐白，情绪由暗入明 —— */

.heal-veil {
  position: absolute;
  inset: 0;
  background: #fdfdfe;
  opacity: 0;
  pointer-events: none;
}

.is-healing {
  .full-img,
  .full-fill {
    animation: heal-zoom 2.8s cubic-bezier(0.45, 0, 0.8, 0.4) both;
    transform-origin: 75% 72%;
  }

  .heal-veil {
    animation: heal-whiten 2.8s ease-in both;
  }
}

@keyframes heal-zoom {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(2.6);
  }
}

@keyframes heal-whiten {
  0% {
    opacity: 0;
  }
  45% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

/* 减弱动态：脚本侧已全部改走完整图路径，此处关掉收束/推进动画 */
@media (prefers-reduced-motion: reduce) {
  .full-wrap.is-converge,
  .full-img {
    animation: none;
  }
}
</style>
