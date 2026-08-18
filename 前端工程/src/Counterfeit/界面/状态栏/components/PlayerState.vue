<template>
  <div class="player-state">
    <span class="field">
      <span class="field-label">位置</span>
      <span class="field-sep">·</span>
      <span class="field-value">{{ location }}</span>
    </span>
    <span class="field">
      <span class="field-label">金钱</span>
      <span class="field-sep">·</span>
      <span class="field-value">{{ cashText }}</span>
    </span>
    <span class="field">
      <span class="field-label">持有</span>
      <span class="field-sep">·</span>
      <span class="field-value">{{ items.length ? items.join('、') : '无' }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  location: string;
  cashText: string;
  items: string[];
}>();
</script>

<style scoped>
.player-state {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
}

.field {
  overflow-wrap: anywhere;
  min-width: 0;
}

.field-label {
  color: var(--c-text-muted);
}

.field-sep {
  color: var(--c-border-strong);
  margin: 0 4px;
}

.field-value {
  color: var(--c-text);
}
</style>
