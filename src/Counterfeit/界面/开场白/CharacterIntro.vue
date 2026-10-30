<template>
  <main class="character-intro" aria-label="拉芙希妮专属 OP">
    <video
      ref="video"
      class="character-video"
      aria-label="阿尔吉侬"
      playsinline
      controls
      preload="auto"
      @playing="onPlaying"
      @ended="finish"
      @error="onError"
    ></video>
    <button v-if="needsGesture" class="play-button" @click="play">播放专属 OP</button>
    <p v-else-if="loading" class="loading" role="status">正在加载专属 OP…{{ downloadProgress }}%（约 32 MB）</p>
    <button class="skip-button" @click="finish">跳过，进入序幕</button>
  </main>
</template>

<script setup lang="ts">
import { getBgm } from './audio';
import { laffOpVideoUrl } from './characterIntroAsset';
import { useOpeningStore } from './store';
import { showToast } from './toast';

const store = useOpeningStore();
const video = ref<HTMLVideoElement | null>(null);
const needsGesture = ref(false);
const loading = ref(true);
const downloadProgress = ref(0);
const bgm = getBgm();
let resumeBgm = false;
let active = true;
let finished = false;
let loadTimer: ReturnType<typeof window.setTimeout> | undefined;
let media: HTMLVideoElement | null = null;
const request = new AbortController();
let objectUrl: string | null = null;

async function play() {
  const el = media;
  if (!el || !active || finished) return;
  needsGesture.value = false;
  try {
    await el.play();
    if (!active || finished) el.pause();
  } catch (error) {
    if (!active || finished) return;
    window.clearTimeout(loadTimer);
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      onError();
      return;
    }
    // 选人页的过渡动画可能使浏览器丢失点击授权，保留有声播放的明确入口。
    loading.value = false;
    needsGesture.value = true;
  }
}

function onPlaying() {
  loading.value = false;
  needsGesture.value = false;
  window.clearTimeout(loadTimer);
}

function finish() {
  if (finished || !active) return;
  finished = true;
  window.clearTimeout(loadTimer);
  request.abort();
  media?.pause();
  store.finishCharacterIntro();
}

function onError() {
  if (finished || !active) return;
  showToast('专属 OP 暂时无法播放，已继续序幕', 'info');
  finish();
}

function pauseOnPageHide() {
  // 换聊天或关闭页面时暂停所有旧声音，不能恢复旧界面的 BGM。
  resumeBgm = false;
  active = false;
  window.clearTimeout(loadTimer);
  request.abort();
  media?.pause();
}

onMounted(async () => {
  media = video.value;
  resumeBgm = !bgm.paused;
  bgm.pause();
  window.addEventListener('pagehide', pauseOnPageHide);
  loadTimer = window.setTimeout(onError, 180000);
  try {
    // 远程完整读取只在选定拉芙后发生。避免浏览器媒体分段请求一直挂起，
    // 并让进度拖动使用已读取的数据；离屏时中止请求并释放临时地址。
    const response = await fetch(laffOpVideoUrl(), { signal: request.signal });
    if (!response.ok) throw new Error(`OP HTTP ${response.status}`);
    let blob: Blob;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      const total = Number(response.headers.get('content-length')) || 31818852;
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!active || finished) return;
        chunks.push(value as Uint8Array<ArrayBuffer>);
        received += value.byteLength;
        downloadProgress.value = Math.min(99, Math.round((received / total) * 100));
      }
      blob = new Blob(chunks, { type: 'video/mp4' });
    } else {
      const downloaded = await response.blob();
      // GitHub Raw 可能使用 application/octet-stream，显式保留视频 MIME。
      blob = downloaded.slice(0, downloaded.size, 'video/mp4');
    }
    downloadProgress.value = 100;
    if (!active || finished || !media) return;
    objectUrl = URL.createObjectURL(blob);
    media.src = objectUrl;
    media.load();
    await play();
  } catch {
    if (active && !finished) onError();
  }
});

onBeforeUnmount(() => {
  active = false;
  window.clearTimeout(loadTimer);
  request.abort();
  window.removeEventListener('pagehide', pauseOnPageHide);
  media?.pause();
  media?.removeAttribute('src');
  media?.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (finished && resumeBgm) void bgm.play().catch(() => {});
});
</script>

<style scoped>
.character-intro {
  position: relative;
  height: 100vh;
  height: 100dvh;
  min-height: 280px;
  background: #08070b;
  color: #fff;
}
.character-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.skip-button, .play-button {
  position: absolute;
  z-index: 1;
  padding: 12px 18px;
  border: 1px solid #ffffff80;
  border-radius: 8px;
  background: #14101de6;
  color: #fff;
  cursor: pointer;
}
.skip-button { top: max(16px, env(safe-area-inset-top)); right: 16px; }
.play-button { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.loading { position: absolute; top: 45%; width: 100%; text-align: center; pointer-events: none; }
.skip-button:focus-visible, .play-button:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
</style>
