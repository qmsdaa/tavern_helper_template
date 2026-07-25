<template>
  <div class="gate-screen" @click="start">
    <span class="gate-glow glow-a" aria-hidden="true"></span>
    <span class="gate-glow glow-b" aria-hidden="true"></span>

    <header class="gate-header">
      <h1 class="gate-title">
        <span v-for="(line, i) in TITLE_COPY.lines" :key="i" class="gate-line">
          <template v-for="(seg, j) in line.segments" :key="j">{{ seg.text }}</template>
        </span>
      </h1>
      <p class="gate-sub">{{ TITLE_COPY.subtitle }}</p>
    </header>

    <p class="gate-prompt"><i class="fa-solid fa-play"></i> 点击屏幕开始</p>
    <p class="gate-note">建议开启声音体验</p>
  </div>
</template>

<script setup lang="ts">
import { getBgm } from './audio';
import { TITLE_COPY } from './copy';
import { preloadIntroAssets } from './introAssets';
import { useOpeningStore } from './store';
import { showToast } from './toast';

const store = useOpeningStore();

// 等待点击期间预载序奏 CG，避免万花筒中途卡图
onMounted(() => {
  preloadIntroAssets();
});

/** 首次用户交互：解锁 BGM（浏览器 autoplay 限制）→ 进入万花筒序奏 */
async function start() {
  const bgm = getBgm();
  if (bgm.paused) {
    try {
      await bgm.play();
    } catch (error) {
      console.warn('[开场白] BGM 播放失败', error);
      showToast('浏览器阻止了自动播放，可到标题屏手动开启', 'info');
    }
  }
  store.toIntro();
}
</script>

<style lang="scss" scoped>
.gate-screen {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 32px 16px;
  cursor: pointer;
  background:
    radial-gradient(ellipse 90% 60% at 50% 30%, #3a2c3c 0%, transparent 70%),
    linear-gradient(160deg, #191219 0%, #241a26 55%, #1b1420 100%);
  user-select: none;
}

.gate-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  animation: glow-drift 9s ease-in-out infinite alternate;

  &.glow-a {
    width: 46vmin;
    height: 46vmin;
    left: 8%;
    top: 12%;
    background: rgba(229, 138, 165, 0.22);
  }

  &.glow-b {
    width: 40vmin;
    height: 40vmin;
    right: 6%;
    bottom: 14%;
    background: rgba(167, 139, 250, 0.18);
    animation-delay: 2.5s;
  }
}

@keyframes glow-drift {
  from {
    transform: translate3d(-3%, -2%, 0) scale(0.96);
  }
  to {
    transform: translate3d(3%, 4%, 0) scale(1.06);
  }
}

.gate-header {
  position: relative;
  text-align: center;
  animation: gate-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes gate-in {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.gate-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  font-family: var(--font-title);
  font-weight: 900;
  font-size: clamp(21px, 6vw, 36px);
  line-height: 1.5;
  letter-spacing: 1px;
  color: #f7eef3;
  text-shadow: 0 0 26px rgba(229, 138, 165, 0.45);
}

.gate-line {
  display: block;
}

.gate-sub {
  margin-top: 14px;
  font-family: var(--font-latin);
  font-size: clamp(22px, 6vw, 32px);
  font-style: italic;
  letter-spacing: 8px;
  color: #f5c04e;
  text-shadow: 0 0 18px rgba(245, 192, 78, 0.35);
}

.gate-prompt {
  position: relative;
  margin-top: 34px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  letter-spacing: 4px;
  color: rgba(247, 238, 243, 0.9);
  animation: prompt-pulse 1.8s ease-in-out infinite;
}

@keyframes prompt-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

.gate-note {
  position: relative;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(247, 238, 243, 0.4);
}

@media (prefers-reduced-motion: reduce) {
  .gate-glow,
  .gate-prompt {
    animation: none;
  }
}
</style>
