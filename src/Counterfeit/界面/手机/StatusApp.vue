<template>
  <div class="app-screen">
    <AppHeader title="状态" />

    <div class="status-scroll">
      <section class="card">
        <h3 class="card-title">当前世界</h3>
        <div class="row"><span>幕</span><b>{{ actText }}</b></div>
        <div class="row"><span>场景</span><b>{{ sceneText }}</b></div>
        <div class="row"><span>日期</span><b>{{ dateText }}</b></div>
        <div class="row"><span>主角</span><b>{{ heroText }}</b></div>
        <div class="row"><span>位置</span><b>{{ locationText }}</b></div>
      </section>

      <section class="card">
        <h3 class="card-title">随身状态</h3>
        <div class="row"><span>金钱</span><b>{{ cashText }}</b></div>
        <div class="items-block">
          <span class="items-label">持有物品</span>
          <div v-if="store.snapshot.carriedItems.length" class="item-list">
            <span v-for="item in store.snapshot.carriedItems" :key="item" class="item-chip">{{ item }}</span>
          </div>
          <p v-else class="empty-inline">无</p>
        </div>
      </section>

      <section class="characters-section">
        <h3 class="section-title">当前在场</h3>
        <article v-for="character in presentCharacters" :key="character.canonicalName" class="character-card">
          <header class="character-head">
            <div>
              <h4>{{ character.record.display_name }}</h4>
              <p>正在当前场景中</p>
            </div>
            <span class="relationship-pill">{{ relationshipTier(character.record.relationship) }}</span>
          </header>

          <section class="memory-block">
            <div>
              <span>最近记得</span>
              <p>{{ character.record.latest_user_memory.memory || '还没有留下足以反复想起的片段' }}</p>
            </div>
            <div class="inner-thought">
              <span>没有说出口</span>
              <p>
                {{
                  character.record.latest_user_memory.inner_thought
                    ? `“${character.record.latest_user_memory.inner_thought}”`
                    : '……'
                }}
              </p>
            </div>
          </section>

          <section class="outfit-block">
            <h5>当前穿搭</h5>
            <div class="outfit-grid">
              <div v-for="row in outfitRows(character.record)" :key="row.key" class="outfit-row">
                <span>{{ row.label }}</span>
                <b>{{ row.value }}</b>
              </div>
            </div>
            <p class="outfit-note">仅显示剧情中最后一次明确确认的信息；未确认项不会根据常识推断。</p>
          </section>
        </article>

        <p v-if="!presentCharacters.length" class="empty-card">
          当前没有已识别且在场的角色。角色离场后不会在这里显示，但已确认的关系和穿搭记录仍会保留。
        </p>
      </section>

      <p v-if="!store.snapshot.hasMvu" class="mvu-hint">
        未检测到 MVU 变量（预览模式或尚未完成开局）。进入游戏后这里会同步当前聊天的 stat_data。
      </p>

      <button class="refresh-btn" @click="store.refresh()">
        <i class="fa-solid fa-arrows-rotate"></i> 刷新
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import {
  actNameOf,
  cnDate,
  formatCash,
  povDisplayName,
  relationshipTier,
  type CharacterSnapshot,
} from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();

const actText = computed(() => actNameOf(store.snapshot.scene) || '—');
const sceneText = computed(() => (store.snapshot.scene != null ? `场景 ${store.snapshot.scene}` : '—'));
const dateText = computed(() => (store.snapshot.date ? cnDate(store.snapshot.date) : '—'));
const heroText = computed(() => {
  if (store.snapshot.mode === 'custom') return store.snapshot.customName || '自建角色';
  return povDisplayName(store.snapshot.pov) || '—';
});
const locationText = computed(() => store.snapshot.location || '未确认');
const cashText = computed(() => formatCash(store.snapshot.cash));

const presentCharacters = computed(() =>
  Object.entries(store.snapshot.characters)
    .filter(([, record]) => record.present && record.known)
    .map(([canonicalName, record]) => ({ canonicalName, record }))
    .sort((a, b) => a.record.display_name.localeCompare(b.record.display_name, 'zh-CN')),
);

const OUTFIT_FIELDS: { key: keyof CharacterSnapshot['outfit']; label: string }[] = [
  { key: 'outerwear', label: '外套' },
  { key: 'inner_layer', label: '内衬' },
  { key: 'bottoms', label: '下装' },
  { key: 'socks', label: '袜子' },
  { key: 'underwear', label: '内衣' },
  { key: 'shoes', label: '鞋子' },
];

function outfitRows(character: CharacterSnapshot) {
  return OUTFIT_FIELDS.map(({ key, label }) => ({
    key,
    label,
    value: character.outfit[key] || '未确认',
  }));
}
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--c-phone-screen);
}

.status-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 8px 16px 20px;
}

.card,
.character-card,
.empty-card {
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.card {
  padding: 14px 16px;
}

.card-title,
.section-title {
  margin-bottom: 10px;
  color: var(--c-ios-gray);
  font-size: 13px;
  letter-spacing: 2px;
}

.section-title {
  padding: 0 2px;
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  font-size: 14px;

  & + .row {
    border-top: 1px solid var(--c-separator);
  }

  span {
    flex: none;
    color: var(--c-ios-gray);
  }

  b {
    text-align: right;
    font-weight: 600;
  }
}

.items-block {
  border-top: 1px solid var(--c-separator);
  padding-top: 9px;
}

.items-label {
  color: var(--c-ios-gray);
  font-size: 13px;
}

.item-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.item-chip {
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--c-phone-screen);
  font-size: 12px;
  line-height: 1.4;
}

.empty-inline {
  margin-top: 5px;
  color: var(--c-ios-gray);
  font-size: 13px;
}

.characters-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-card {
  padding: 14px;
}

.character-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h4 {
    font-size: 16px;
    font-weight: 700;
  }

  p {
    margin-top: 2px;
    color: var(--c-ios-gray);
    font-size: 11px;
  }
}

.relationship-pill {
  flex: none;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(236, 95, 146, 0.1);
  color: var(--c-primary-strong);
  font-size: 11px;
  font-weight: 700;
}

.memory-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  border-top: 1px solid var(--c-separator);
  padding-top: 10px;

  span {
    color: var(--c-ios-gray);
    font-size: 11px;
  }

  p {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.65;
  }
}

.inner-thought p {
  color: #8c6671;
  font-style: italic;
}

.outfit-block {
  margin-top: 12px;
  border-top: 1px solid var(--c-separator);
  padding-top: 10px;

  h5 {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
  }
}

.outfit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 10px;
}

.outfit-row {
  min-width: 0;
  border-radius: 10px;
  background: var(--c-phone-screen);
  padding: 7px 8px;

  span,
  b {
    display: block;
  }

  span {
    color: var(--c-ios-gray);
    font-size: 10px;
  }

  b {
    margin-top: 2px;
    overflow-wrap: anywhere;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.45;
  }
}

.outfit-note {
  margin-top: 8px;
  color: var(--c-ios-gray);
  font-size: 10px;
  line-height: 1.55;
}

.empty-card {
  padding: 18px 16px;
  color: var(--c-ios-gray);
  font-size: 12px;
  line-height: 1.75;
}

.mvu-hint {
  padding: 0 4px;
  color: var(--c-ios-gray);
  font-size: 12px;
  line-height: 1.7;
}

.refresh-btn {
  align-self: center;
  padding: 8px 22px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  color: var(--c-ios-blue);
  font-size: 13px;

  i {
    margin-right: 6px;
  }
}
</style>
