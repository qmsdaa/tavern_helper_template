<template>
  <header class="status-header">
    <div class="title-row">
      <template v-if="mode === 'pov'">
        <span class="title">🌸 {{ actName }}</span>
        <span class="scene">
          场景 <b>{{ scene }}</b>
          <span class="scene-total"> / 150</span>
        </span>
      </template>
      <template v-else>
        <span class="title">🌸 Counterfeit · 自建开放世界</span>
      </template>
      <span class="date">{{ dateLabel }}</span>
    </div>
    <div class="player-row">
      <span class="field-label">扮演</span>
      <span class="chip">{{ playerName }}</span>
      <template v-if="branch">
        <span class="field-label branch-label">尾声分支</span>
        <span class="chip chip-branch">{{ branch }}</span>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  mode: 'pov' | 'custom';
  actName: string;
  scene: number;
  dateLabel: string;
  playerName: string;
  branch: string | null;
}>();
</script>

<style scoped>
.status-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  align-items: baseline;
}

.title {
  color: var(--c-primary-strong);
  font-weight: 600;
}

.scene b {
  color: var(--c-text-strong);
}

.scene-total {
  color: var(--c-text-muted);
}

.date {
  margin-left: auto;
  color: var(--c-text-muted);
  overflow-wrap: anywhere;
}

.player-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
}

.field-label {
  color: var(--c-text-muted);
}

.branch-label {
  margin-left: 6px;
}

.chip {
  border: 1px solid var(--c-border-strong);
  color: var(--c-text-muted);
  border-radius: var(--radius-chip);
  padding: 0 10px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.chip-branch {
  border-color: var(--c-primary);
  color: var(--c-primary-strong);
}
</style>
