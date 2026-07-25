<template>
  <div class="app-screen">
    <AppHeader :title="meta?.label ?? '筹备中'" />
    <div class="placeholder-body">
      <span class="placeholder-tile" :style="{ background: meta?.tint }">
        <i :class="meta?.icon"></i>
      </span>
      <h3>{{ meta?.label }}</h3>
      <p>{{ hint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { APPS } from './apps';

const props = defineProps<{ appId: string }>();

const meta = computed(() => APPS.find(a => a.id === props.appId));

const HINTS: Record<string, string> = {
  map: '千叶地图（校外／校园／室内三层），v3 见。',
  forum: '校内论坛生成器，v3 见。',
};

const hint = computed(() => HINTS[props.appId] ?? '筹备中。');
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
}

.placeholder-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;

  h3 {
    font-size: 18px;
  }

  p {
    font-size: 13px;
    color: var(--c-ios-gray);
    line-height: 1.8;
  }
}

.placeholder-tile {
  width: 84px;
  height: 84px;
  border-radius: 24%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 36px;
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
}
</style>
