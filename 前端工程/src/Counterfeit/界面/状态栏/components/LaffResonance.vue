<template>
  <section class="laff-resonance">
    <span class="field-label">Ω 共鸣</span>
    <span class="omega">{{ omega }}</span>
    <span class="hammer-count">· 锤 {{ triggeredCount }}/{{ hammers.length }}</span>
    <span class="hammer-track">
      <span
        v-for="hammer in hammers"
        :key="hammer.key"
        class="hammer"
        :class="hammer.state"
        :title="`${hammer.name} · ${stateLabel(hammer.state)}`"
      >
        <template v-if="hammer.state === 'pending'">▫️</template>
        <template v-else>{{ hammer.emoji }}</template>
      </span>
    </span>
  </section>
</template>

<script setup lang="ts">
import { HAMMER_STATE_LABELS, type HammerView } from '../utils';

const props = defineProps<{
  omega: number;
  hammers: HammerView[];
}>();

const triggeredCount = computed(() => props.hammers.filter(hammer => hammer.state === 'triggered').length);

function stateLabel(state: HammerView['state']): string {
  return HAMMER_STATE_LABELS[state];
}
</script>

<style scoped>
.laff-resonance {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
  border-top: 1px dashed var(--c-border);
  padding-top: 6px;
}

.field-label {
  color: var(--c-text-muted);
}

.omega {
  color: var(--c-primary-strong);
  font-weight: 600;
}

.hammer-count {
  color: var(--c-text-muted);
}

.hammer-track {
  letter-spacing: 2px;
}

.hammer.pending {
  opacity: 0.25;
}

.hammer.missed {
  opacity: 0.35;
  filter: grayscale(1);
}
</style>
