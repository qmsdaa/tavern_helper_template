<template>
  <div class="opening-text">
    <div class="text-card card">
      <div class="text-header">
        <i class="fa-solid fa-book-open"></i>
        <span>序幕</span>
      </div>
      <div class="text-body">
        <p v-for="(paragraph, i) in paragraphs" :key="i" class="paragraph" :style="{ animationDelay: 0.4 + i * 0.5 + 's' }">
          {{ paragraph }}
        </p>
        <span class="cursor"></span>
      </div>
      <button class="btn-primary start-btn" :disabled="store.submitting" @click="store.commit()">
        <i class="fa-solid" :class="store.submitting ? 'fa-spinner fa-spin' : 'fa-play'"></i>
        {{ store.submitting ? '正在写入…' : '开始' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOpeningStore } from './store';

const store = useOpeningStore();

const paragraphs = computed(() => store.openingText.split('\n').filter(line => line.trim().length > 0));

// 直接进入本屏（未做选择）时退回模式选择
onMounted(() => {
  if (!store.mode) {
    store.backToMode();
  }
});
</script>

<style lang="scss" scoped>
.opening-text {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px 40px;
}

.text-card {
  width: 100%;
  max-width: 480px;
  padding: 26px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.text-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-primary-strong);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 4px;
}

.text-body {
  position: relative;
  padding-bottom: 4px;
}

.paragraph {
  font-size: 15px;
  line-height: 2;
  text-indent: 2em;
  margin-bottom: 10px;
  opacity: 0;
  animation: paragraph-in 0.8s ease forwards;
}

@keyframes paragraph-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: var(--c-primary);
  vertical-align: text-bottom;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.start-btn {
  align-self: center;
  min-width: 200px;
}
</style>
