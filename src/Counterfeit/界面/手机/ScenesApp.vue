<template>
  <div class="app-screen">
    <AppHeader title="章节" />
    <div class="scenes-scroll">
      <!-- 当前进度卡 -->
      <section class="card">
        <h3 class="card-title">当前</h3>
        <template v-if="isFree">
          <div class="row"><span>故事</span><b>{{ store.snapshot.campaignTitle }}</b></div>
          <div class="row"><span>模式</span><b>开放世界</b></div>
          <div class="row"><span>日期</span><b>{{ dateText }}</b></div>
          <div class="row"><span>时段</span><b>{{ timeSlotText }}</b></div>
          <p class="free-hint">开放世界不按章节推进，下方日历仅作日期参考。</p>
        </template>
        <template v-else>
          <div class="row"><span>幕</span><b>{{ actText }}</b></div>
          <div class="row"><span>场景</span><b>{{ sceneText }}</b></div>
          <div class="row"><span>日期</span><b>{{ dateText }}</b></div>
          <div class="progress-track"><i :style="{ width: `${progressPct}%` }"></i></div>
          <div class="progress-label">{{ progressLabel }}</div>
          <div v-if="currentTransition" class="transition-card">
            <b>{{ currentTransition.visible_title }}</b>
            <p v-for="line in currentTransition.visible_lines" :key="line">{{ line }}</p>
          </div>
        </template>
      </section>

      <!-- 场景列表 -->
      <section class="card">
        <h3 class="card-title">主线场景索引（{{ entries.length }} 场）</h3>
        <p v-if="store.snapshot.campaignId !== 'main'" class="free-hint">当前DLC只继承 main:118 连续性快照，不激活或伪造编号场景。</p>
        <p v-if="!entries.length" class="empty">没有读到场景条目（未绑定世界书或预览模式）</p>
        <div v-for="item in store.snapshot.campaignId === 'main' ? entries : []" :key="item.id" class="scene-row" :class="statusOf(item)">
          <span class="scene-dot"></span>
          <span class="scene-name">场景 {{ item.number }} · {{ item.title }}</span>
          <span class="scene-date">{{ cnDate(item.date) }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { actNameOf, cnDate, loadSceneEntries, mainCampaignTotal, type SceneEntry } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const entries = ref<SceneEntry[]>([]);
const campaignTotal = ref(0);

const isFree = computed(() => store.snapshot.mode === 'free');
const actText = computed(() => actNameOf(store.snapshot.scene) || '—');
const sceneText = computed(() => (store.snapshot.scene != null ? `场景 ${store.snapshot.scene}` : '—'));
const dateText = computed(() => (store.snapshot.date ? cnDate(store.snapshot.date) : '—'));
const timeSlotText = computed(() => store.snapshot.timeSlot || '未确认');

const total = computed(() => campaignTotal.value || entries.value.length || 1);
const progressPct = computed(() => (store.snapshot.scene != null ? Math.min(100, (store.snapshot.scene / total.value) * 100) : 0));
const progressLabel = computed(() => (store.snapshot.scene != null ? `${store.snapshot.scene} / ${total.value}` : '—'));
const currentTransition = computed(() => entries.value.find(item => item.number === store.snapshot.scene)?.transition ?? null);

function statusOf(item: SceneEntry): string {
  if (isFree.value) {
    return '';
  }
  const current = store.snapshot.scene;
  if (current == null) {
    return '';
  }
  if (item.number < current) return 'done';
  if (item.number === current) return 'current';
  return 'future';
}

onMounted(async () => {
  if (store.snapshot.campaignId !== 'main') return;
  [entries.value, campaignTotal.value] = await Promise.all([loadSceneEntries(), mainCampaignTotal()]);
});
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.scenes-scroll {
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
  padding: 6px 0;
  font-size: 14px;

  span {
    color: var(--c-ios-gray);
  }
}

.progress-track {
  margin-top: 10px;
  height: 6px;
  border-radius: 3px;
  background: #ececf1;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--c-primary), var(--c-accent));
  }
}

.progress-label {
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-ios-gray);
  text-align: right;
}

.transition-card {
  margin-top: 12px;
  padding: 10px 12px;
  border-left: 3px solid var(--c-primary);
  border-radius: 8px;
  background: #f7f7fb;
  font-size: 12px;
  line-height: 1.65;

  b { display: block; margin-bottom: 3px; }
  p { margin: 0; color: var(--c-ios-gray); }
}

.empty {
  font-size: 13px;
  color: var(--c-ios-gray);
}

.free-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--c-ios-gray);
}

.scene-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 13px;

  & + .scene-row {
    border-top: 1px solid var(--c-separator);
  }

  &.done {
    color: var(--c-ios-gray);

    .scene-dot {
      background: var(--c-success);
    }
  }

  &.current {
    font-weight: 700;

    .scene-dot {
      background: var(--c-ios-blue);
      box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.2);
    }
  }

  &.future {
    color: #b9b9c0;

    .scene-dot {
      background: #d5d5db;
    }
  }
}

.scene-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: #ccc;
}

.scene-name {
  flex: 1;
}

.scene-date {
  flex: none;
  font-size: 12px;
  color: var(--c-ios-gray);
}
</style>
