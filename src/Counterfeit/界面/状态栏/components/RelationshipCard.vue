<template>
  <div class="rel-card" :class="{ open: isOpen }">
    <button
      type="button"
      class="rel-summary"
      :aria-expanded="isOpen"
      :aria-controls="detailId"
      @click="isOpen = !isOpen"
    >
      <span class="rel-title">
        <span class="rel-name">{{ character.displayName }}</span>
        <span class="rel-dot">·</span>
        <b class="rel-label">{{ character.label }}</b>
      </span>
      <span class="rel-chevron" aria-hidden="true">▾</span>
    </button>
    <div :id="detailId" class="rel-detail" :class="{ open: isOpen }" :inert="!isOpen">
      <div class="rel-detail-inner">
        <div class="rel-line">
          <span class="rel-key">最近记得</span>
          <span class="rel-value"> · {{ character.memory || memoryPlaceholder }}</span>
        </div>
        <div class="rel-line rel-thought">
          <span class="rel-key">没有说出口</span>
          <span class="rel-value"> · {{ thoughtText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MEMORY_EMPTY_PLACEHOLDER, THOUGHT_EMPTY_PLACEHOLDER, type PresentCharacterView } from '../utils';

const props = defineProps<{
  character: PresentCharacterView;
}>();

const isOpen = ref(false);

// 每个角色卡片独立的展开状态与锚点 id（同一楼层内以规范全名区分）
const detailId = `rel-detail-${props.character.key}`;

const memoryPlaceholder = MEMORY_EMPTY_PLACEHOLDER;

const thoughtText = computed(() =>
  props.character.innerThought ? `“${props.character.innerThought}”` : THOUGHT_EMPTY_PLACEHOLDER,
);
</script>

<style scoped>
.rel-card {
  border: 1px solid var(--c-border);
  background: var(--c-surface-muted);
  border-radius: 9px;
  min-width: 0;
}

.rel-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 40px; /* 触控展开区域 */
  padding: 4px 12px;
  text-align: left;
  user-select: none;
  border-radius: 9px;
}

.rel-title {
  overflow-wrap: anywhere;
  min-width: 0;
}

.rel-dot {
  color: var(--c-border-strong);
  margin: 0 4px;
}

.rel-label {
  color: var(--c-primary-strong);
  font-weight: 600;
}

.rel-chevron {
  flex: none;
  color: var(--c-text-muted);
  font-size: 11px;
  transition: transform 0.18s ease;
}

.rel-card.open .rel-chevron {
  transform: rotate(180deg);
}

/* 克制的展开动画：grid 行高插值，高度自适应内容 */
.rel-detail {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.18s ease,
    opacity 0.18s ease;
}

.rel-detail.open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.rel-detail-inner {
  overflow: hidden;
  border-top: 1px dashed var(--c-border);
  margin: 0 10px;
  padding: 7px 2px 8px;
  line-height: 1.65;
}

.rel-detail:not(.open) .rel-detail-inner {
  border-top-color: transparent;
  padding-top: 0;
  padding-bottom: 0;
}

.rel-line + .rel-line {
  margin-top: 3px;
}

.rel-key {
  color: var(--c-text-muted);
}

.rel-value {
  color: var(--c-text);
  overflow-wrap: anywhere;
}

.rel-thought .rel-value {
  color: var(--c-primary-strong);
  font-style: italic;
}

@media (prefers-reduced-motion: reduce) {
  .rel-detail,
  .rel-chevron {
    transition: none;
  }
}
</style>
