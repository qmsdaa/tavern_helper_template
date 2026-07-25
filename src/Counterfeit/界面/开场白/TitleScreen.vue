<template>
  <div class="title-screen" @pointermove="onPointerMove">
    <!-- 背景：白底 + 动漫插画樱花树 + 可读性白纱 -->
    <img class="bg-tree" :src="portraitUrl('bg_sakura.webp')" alt="" aria-hidden="true" draggable="false" />
    <div class="bg-veil" aria-hidden="true"></div>

    <!-- 漂浮光斑 -->
    <span
      v-for="(bokeh, i) in bokehs"
      :key="'b' + i"
      class="bokeh"
      :style="{
        left: bokeh.left + '%',
        top: bokeh.top + '%',
        width: bokeh.size + 'px',
        height: bokeh.size + 'px',
        animationDuration: bokeh.duration + 's',
        animationDelay: bokeh.delay + 's',
      }"
    ></span>

    <!-- BGM 开关 -->
    <button
      class="bgm-toggle"
      :class="{ 'is-off': !bgmOn }"
      :title="bgmOn ? '关闭音乐' : '播放音乐'"
      @click="toggleBgm"
    >
      <i class="fa-solid fa-music"></i>
    </button>

    <div class="title-body">
      <!-- 主标题（日文原名 · 两行错拍淡入 · 彩色分段+白色描边的轻小说 logo 风） -->
      <header class="title-header">
        <h1 class="main-title">
          <span v-for="(line, i) in TITLE_COPY.lines" :key="i" class="title-line" :class="`line-${i + 1}`">
            <span
              v-for="(seg, j) in line.segments"
              :key="j"
              class="title-segment"
              :style="{ color: seg.color }"
            >
              {{ seg.text }}
            </span>
          </span>
        </h1>
        <p class="sub-title">{{ TITLE_COPY.subtitle }}</p>
      </header>

      <!-- 封面（入场浮现 + 持续轻浮动 + 周期性光泽扫过 + 指针视差 · 毛玻璃卡框） -->
      <div class="cover-wrap">
        <div
          class="cover-card"
          :style="{ transform: `translate(${parallax.x}px, ${parallax.y}px)` }"
        >
          <img class="cover-img" :src="portraitUrl('cover.webp')" alt="开场白封面" draggable="false" />
          <span class="cover-shine" aria-hidden="true"></span>
        </div>
        <span class="cover-glow" aria-hidden="true"></span>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button class="btn-primary action-1" @click="store.toMode()">
          新的游戏 <i class="fa-solid fa-arrow-right"></i>
        </button>
        <button class="btn-ghost action-2" @click="store.toGallery()"><i class="fa-solid fa-images"></i> 画廊</button>
        <button class="btn-load action-3" disabled title="后续版本开放">
          <i class="fa-solid fa-folder-open"></i> 读取存档
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TITLE_COPY } from './copy';
import { portraitUrl } from './data';
import { getBgm } from './audio';
import { useOpeningStore } from './store';
import { showToast } from './toast';

const store = useOpeningStore();

// 漂浮光斑：柔和景深圆点，缓慢漂移
const bokehs = Array.from({ length: 8 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 40 + Math.random() * 90,
  duration: 10 + Math.random() * 8,
  delay: Math.random() * 6,
}));

// 封面指针视差（移动端无 pointermove 时保持 0）
const parallax = reactive({ x: 0, y: 0 });
function onPointerMove(event: PointerEvent) {
  const { innerWidth, innerHeight } = window;
  parallax.x = ((event.clientX - innerWidth / 2) / innerWidth) * 8;
  parallax.y = ((event.clientY - innerHeight / 2) / innerHeight) * 6;
}

// BGM：autoplay 限制下由首次点击启动
const bgmOn = ref(false);

onMounted(() => {
  bgmOn.value = !getBgm().paused;
});

async function toggleBgm() {
  const bgm = getBgm();
  if (bgm.paused) {
    try {
      await bgm.play();
      bgmOn.value = true;
    } catch (error) {
      console.warn('[开场白] BGM 播放失败', error);
      showToast('浏览器阻止了自动播放，请再点一次', 'info');
    }
  } else {
    bgm.pause();
    bgmOn.value = false;
  }
}
</script>

<style lang="scss" scoped>
.title-screen {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 44px;
  background: #fdfdfe;
}

/* 樱花树插画背景：右上构图，缓慢呼吸推近 */
.bg-tree {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 68% 16%;
  opacity: 0.92;
  pointer-events: none;
  animation: tree-drift 26s ease-in-out infinite alternate;
}

@keyframes tree-drift {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.05) translate(-0.6%, 0.8%);
  }
}

/* 可读性白纱：上部透出树冠，向下渐变为白底托住标题/封面/按钮 */
.bg-veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.42) 36%,
    rgba(255, 255, 255, 0.84) 68%,
    rgba(255, 255, 255, 0.94) 100%
  );
}

.bokeh {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(240, 164, 191, 0.5) 0%, rgba(183, 149, 245, 0.22) 55%, transparent 72%);
  filter: blur(2px);
  pointer-events: none;
  animation-name: bokeh-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

@keyframes bokeh-drift {
  from {
    transform: translate3d(-12px, -10px, 0) scale(0.95);
    opacity: 0.5;
  }
  to {
    transform: translate3d(14px, 16px, 0) scale(1.08);
    opacity: 0.9;
  }
}

.bgm-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--shadow-card);
  color: var(--c-primary-strong);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.08);
  }

  &.is-off {
    color: var(--c-text-muted);
    opacity: 0.6;

    i {
      position: relative;

      &::after {
        content: '';
        position: absolute;
        left: -3px;
        right: -3px;
        top: 50%;
        height: 2px;
        background: currentColor;
        transform: rotate(-45deg);
      }
    }
  }
}

.title-body {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  margin: auto;
}

.title-header {
  text-align: center;
}

.main-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 100%;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: clamp(20px, 6vw, 38px);
  line-height: 1.42;
  letter-spacing: 0.5px;
}

.title-line {
  display: block;
  opacity: 0;
  animation: line-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;

  &.line-1 {
    animation-delay: 0.15s;
  }

  &.line-2 {
    animation-delay: 0.4s;
  }

  &.line-3 {
    animation-delay: 0.6s;
  }
}

.title-segment {
  /* 彩色分段（颜色来自 copy.yaml 内联 style）+ 白色外描边（paint-order 让描边垫在填充下面）+ 柔和投影 */
  -webkit-text-stroke: 5px #ffffff;
  paint-order: stroke fill;
  filter: drop-shadow(0 2px 0 rgba(255, 255, 255, 0.65)) drop-shadow(0 8px 18px rgba(229, 138, 165, 0.55));
}

@keyframes line-in {
  from {
    opacity: 0;
    transform: translateY(-14px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.sub-title {
  margin-top: 12px;
  font-family: var(--font-latin);
  font-size: clamp(26px, 7vw, 36px);
  font-weight: 600;
  font-style: italic;
  letter-spacing: 6px;
  color: #f5c04e;
  -webkit-text-stroke: 1px rgba(214, 146, 46, 0.55);
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.85);
  opacity: 0;
  animation: fade-in 0.8s ease 0.85s forwards;
}

@keyframes fade-in {
  to {
    opacity: 1;
  }
}

/* 封面区：视差层 + 呼吸光晕 */
.cover-wrap {
  position: relative;
  width: min(84vw, 380px);
  opacity: 0;
  animation: cover-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards;
}

@keyframes cover-in {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.cover-card {
  position: relative;
  z-index: 1;
  padding: 12px;
  overflow: hidden;
  border-radius: 18px;
  /* 毛玻璃卡框：半透明白 + 背景模糊，与樱花树背景自然区分 */
  background: rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 0 12px 32px rgba(190, 145, 170, 0.28);
  transition: transform 0.25s ease-out;
  animation: cover-float 6s ease-in-out 1.6s infinite;
}

@keyframes cover-float {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -7px;
  }
}

.cover-img {
  display: block;
  width: 100%;
  border-radius: 10px;
  user-select: none;
}

/* 周期性光泽扫过封面 */
.cover-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.55) 48%, transparent 62%);
  transform: translateX(-120%);
  animation: shine-sweep 5.5s ease-in-out 2.2s infinite;
  pointer-events: none;
}

@keyframes shine-sweep {
  0%,
  55% {
    transform: translateX(-120%);
  }
  85%,
  100% {
    transform: translateX(120%);
  }
}

/* 封面背后的呼吸光晕 */
.cover-glow {
  position: absolute;
  inset: 8% 4%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(240, 164, 191, 0.5) 0%, rgba(183, 149, 245, 0.28) 55%, transparent 75%);
  filter: blur(18px);
  animation: glow-breathe 4.5s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.96);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.04);
  }
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;

  .action-1,
  .action-2,
  .action-3 {
    opacity: 0;
    animation: action-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .action-1 {
    animation-delay: 1.15s;
  }

  .action-2 {
    animation-delay: 1.3s;
  }

  .action-3 {
    animation-delay: 1.45s;
    animation-name: action-in-dim;
  }
}

@keyframes action-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes action-in-dim {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 0.75;
    transform: translateY(0);
  }
}

.btn-load {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: var(--radius-button);
  background: var(--c-surface-muted);
  border: 1px solid var(--c-border);
  color: var(--c-text-muted);
  font-size: 15px;
  cursor: not-allowed;
  opacity: 0.75;
}
</style>
