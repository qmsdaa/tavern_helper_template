<template>
  <section class="rel-section">
    <span class="field-label">当前关系</span>
    <div v-if="characters.length" class="rel-grid">
      <RelationshipCard v-for="character in characters" :key="character.key" :character="character" />
    </div>
    <span v-else class="rel-empty">当前没有已识别且在场的关系对象</span>
  </section>
</template>

<script setup lang="ts">
import type { PresentCharacterView } from '../utils';
import RelationshipCard from './RelationshipCard.vue';

defineProps<{
  characters: PresentCharacterView[];
}>();
</script>

<style scoped>
.rel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  color: var(--c-text-muted);
}

.rel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
  gap: 6px;
  align-items: start; /* 折叠卡片不被同行展开卡片拉高 */
}

.rel-empty {
  color: var(--c-text-muted);
}
</style>
