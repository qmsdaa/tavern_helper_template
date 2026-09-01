<template>
  <div class="app-header">
    <button class="back-btn" title="回主屏幕" @click="store.goHome()">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <h2 class="app-title">{{ title }}</h2>
    <span class="header-slot"><slot></slot></span>
  </div>
</template>

<script setup lang="ts">
import { usePhoneStore } from './store';

defineProps<{ title: string }>();
const store = usePhoneStore();
</script>

<style lang="scss" scoped>
.app-header {
  flex: none;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-separator);
  position: relative;
  z-index: 4;
}

.back-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--c-ios-blue);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(10, 132, 255, 0.1);
  }
}

.app-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  transform: translateX(-17px);
  /* 标题盒子因 translateX 与 34px 返回键重叠，作为后渲染兄弟会吞掉返回键的点按；
     标题是纯文本无交互，直接放穿透 */
  pointer-events: none;
}

.header-slot {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
}
</style>
