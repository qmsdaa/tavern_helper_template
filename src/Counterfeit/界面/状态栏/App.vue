<template>
  <div class="status-bar">
    <div v-if="!data.mode" class="not-started">🌸 Counterfeit · 尚未选择模式，请在开场白界面完成开局</div>
    <template v-else>
      <StatusHeader
        :mode="data.mode"
        :act-name="actNameOf(data.current_scene)"
        :scene="data.current_scene"
        :date-label="formatDateLabel(data.world.current_date)"
        :player-name="playerLabel(data)"
        :branch="data.branch_choice"
      />
      <PlayerState
        :location="data.world.current_location"
        :cash-text="cashLabel(data.player.cash)"
        :items="data.player.carried_items"
      />
      <RelationshipList :characters="characters" />
      <LaffResonance
        v-if="data.mode === 'pov' && data.current_pov === 'laff'"
        :omega="data['Ω_resonance']"
        :hammers="hammers"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import LaffResonance from './components/LaffResonance.vue';
import PlayerState from './components/PlayerState.vue';
import RelationshipList from './components/RelationshipList.vue';
import StatusHeader from './components/StatusHeader.vue';
import { useDataStore } from './store';
import { actNameOf, cashLabel, formatDateLabel, hammerViews, playerLabel, presentCharacters } from './utils';

const store = useDataStore();
const data = computed(() => store.data);

const characters = computed(() => presentCharacters(data.value));
const hammers = computed(() => hammerViews(data.value));
</script>

<style scoped>
.status-bar {
  width: 86%;
  max-width: 720px;
  margin: 14px auto;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-top: 3px solid var(--c-primary-soft);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  font-size: 13px;
  line-height: 1.8;
}

.not-started {
  text-align: center;
  color: var(--c-text-muted);
  letter-spacing: 1px;
}

/* 窄屏：状态栏铺满楼层宽度，保证 360px 无横向滚动 */
@media (max-width: 480px) {
  .status-bar {
    width: 100%;
    margin: 8px auto;
    padding: 8px 12px;
  }
}
</style>
