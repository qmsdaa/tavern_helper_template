<template>
  <div class="app-screen">
    <AppHeader title="状态" />

    <div class="status-scroll">
      <!-- 世界 -->
      <section class="card">
        <h3 class="card-title">世界</h3>
        <div class="row"><span>幕</span><b>{{ actText }}</b></div>
        <div class="row"><span>场景</span><b>{{ sceneText }}</b></div>
        <div class="row"><span>日期</span><b>{{ dateText }}</b></div>
        <div class="row"><span>主角</span><b>{{ heroText }}</b></div>
      </section>

      <!-- 好感 -->
      <section class="card">
        <h3 class="card-title">好感</h3>
        <template v-if="affectionRows.length">
          <div v-for="row in affectionRows" :key="row.key" class="affection-row">
            <span class="affection-name">{{ row.label }}</span>
            <span class="affection-bar"><i :style="{ width: `${row.value}%` }"></i></span>
            <span class="affection-tier">{{ row.tier }}</span>
          </div>
        </template>
        <p v-else class="empty">还没有读到好感变量</p>
      </section>

      <p v-if="!store.snapshot.hasMvu" class="mvu-hint">
        未检测到 MVU 变量（预览模式或未建卡）。进入游戏后这里会同步 stat_data。
      </p>

      <button class="refresh-btn" @click="store.refresh()">
        <i class="fa-solid fa-arrows-rotate"></i> 刷新
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { AFFECTION_LABELS, actNameOf, affectionTier, cnDate, povDisplayName } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();

const actText = computed(() => actNameOf(store.snapshot.scene) || '—');
const sceneText = computed(() => (store.snapshot.scene != null ? `场景 ${store.snapshot.scene}` : '—'));
const dateText = computed(() => (store.snapshot.date ? cnDate(store.snapshot.date) : '—'));
const heroText = computed(() => {
  if (store.snapshot.mode === 'custom') return store.snapshot.customName || '自建角色';
  return povDisplayName(store.snapshot.pov) || '—';
});

const affectionRows = computed(() =>
  Object.entries(AFFECTION_LABELS)
    .filter(([key]) => store.snapshot.affection[key] != null)
    .map(([key, label]) => {
      const value = store.snapshot.affection[key];
      return { key, label, value, tier: affectionTier(value) };
    }),
);
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.status-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 13px;
  color: var(--c-ios-gray);
  margin-bottom: 10px;
  letter-spacing: 2px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  font-size: 14px;

  & + .row {
    border-top: 1px solid var(--c-separator);
  }

  span {
    color: var(--c-ios-gray);
  }
}

.affection-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 14px;

  & + .affection-row {
    border-top: 1px solid var(--c-separator);
  }
}

.affection-name {
  width: 52px;
  flex: none;
}

.affection-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #ececf1;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--c-primary), var(--c-accent));
    transition: width 0.4s ease;
  }
}

.affection-tier {
  width: 34px;
  flex: none;
  text-align: right;
  font-size: 12px;
  color: var(--c-primary-strong);
}

.empty {
  font-size: 13px;
  color: var(--c-ios-gray);
}

.mvu-hint {
  font-size: 12px;
  color: var(--c-ios-gray);
  line-height: 1.7;
  padding: 0 4px;
}

.refresh-btn {
  align-self: center;
  padding: 8px 22px;
  border-radius: 999px;
  background: #fff;
  font-size: 13px;
  color: var(--c-ios-blue);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  i {
    margin-right: 6px;
  }
}
</style>
