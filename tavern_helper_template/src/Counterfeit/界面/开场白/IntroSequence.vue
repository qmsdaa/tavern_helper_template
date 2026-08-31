<template>
  <div class="intro-screen" ref="root" @click="skip">
    <!-- OP 成片：只含 84s 画面段，自带音轨；画面播完由标题屏从交接位置续播 BGM -->
    <video
      ref="op"
      class="op-media"
      :src="opUrl"
      :poster="opPoster"
      playsinline
      preload="auto"
      @timeupdate="onTime"
      @ended="finish"
      @error="onError"
    ></video>

    <span class="skip-hint"><i class="fa-solid fa-forward"></i> 点击屏幕跳过</span>
  </div>
</template>

<script setup lang="ts">
import { OP_PICTURE_END, opPosterUrl, opVideoUrl } from './introVideos';
import { useOpeningStore } from './store';

const store = useOpeningStore();

const opUrl = opVideoUrl();
const opPoster = opPosterUrl();

const op = ref<HTMLVideoElement | null>(null);
const finishing = ref(false);
let finishTimer: number | undefined;

onMounted(async () => {
  const el = op.value;
  if (!el) {
    store.toTitle();
    return;
  }
  // 启动门点击已构成用户手势，有声播放一般放行；个别环境仍拦截时静音降级，画面不停
  try {
    await el.play();
  } catch {
    el.muted = true;
    try {
      await el.play();
    } catch {
      store.toTitle();
    }
  }
});

/** 画面段到点（84s）即收束；ended 兜底（视频全长恰好 84s） */
function onTime() {
  const el = op.value;
  if (el && el.currentTime >= OP_PICTURE_END - 0.15) finish();
}

/** 播完 / 到点 / 跳过：记录 BGM 交接位置并暂停视频（音频由标题屏续上）→ App 级白幕 → 标题屏 */
function finish() {
  if (finishing.value) return;
  finishing.value = true;
  const el = op.value;
  store.opHandoffTime = el ? el.currentTime : 0;
  el?.pause();
  store.veilOn = true;
  finishTimer = window.setTimeout(() => store.toTitle(), 500);
}

function skip() {
  finish();
}

/** OP 加载失败：直接进标题屏（不开白幕），BGM 从头试播 */
function onError() {
  if (finishing.value) return;
  finishing.value = true;
  store.opHandoffTime = 0;
  store.toTitle();
}

onUnmounted(() => {
  window.clearTimeout(finishTimer);
  op.value?.pause();
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

.op-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
</style>
