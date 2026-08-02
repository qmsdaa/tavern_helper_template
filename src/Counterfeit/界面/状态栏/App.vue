<template>
  <!-- 楼层内：紧凑摘要卡片 + 内联展开（无内部滚动条，内容自适应高度） -->
  <div v-if="view === 'panel'" class="status-panel">
    <div v-if="!data.mode" class="not-started">🌸 Counterfeit · 尚未选择模式，请在开场白界面完成开局</div>
    <template v-else>
      <!-- 第一行：章节 / 场景编号 / 日期 / 星期 + 展开收起 -->
      <div class="panel-head">
        <span class="head-title">🌸 {{ barTitle }}</span>
        <span v-if="data.mode === 'pov'" class="head-scene">
          场景 <b>{{ data.current_scene }}</b><span class="scene-total"> / 150</span>
        </span>
        <span class="head-date">{{ formatDateLabel(data.world.current_date) }}</span>
        <button type="button" class="head-expand" :aria-expanded="expanded" @click="expanded = !expanded">
          {{ expanded ? '收起 ▴' : '展开 ▾' }}
        </button>
      </div>
      <!-- 第二行：位置 / 扮演角色 -->
      <div class="panel-sub">
        <span class="sub-field">
          <span class="field-name">位置</span><span class="field-value">{{ data.world.current_location }}</span>
        </span>
        <span class="sub-field">
          <span class="field-name">扮演</span><span class="field-value">{{ playerLabel(data) }}</span>
        </span>
      </div>
      <!-- 第三行：在场角色头像标签 -->
      <div v-if="characters.length" class="panel-chars">
        <button
          v-for="character in characters"
          :key="character.key"
          type="button"
          class="char-chip"
          :title="`${character.displayName} · 查看详情`"
          @click="openChar(character.key)"
        >
          <span class="chip-avatar">
            <img v-if="character.portraitUrl" :src="character.portraitUrl" :alt="character.displayName" loading="lazy" />
            <span v-else class="chip-initial">{{ character.displayName.slice(0, 1) }}</span>
          </span>
          <span class="chip-main">
            <span class="chip-name">{{ character.displayName }}</span>
            <span class="chip-label">{{ character.label }}</span>
          </span>
        </button>
      </div>

      <!-- 展开区：内联自然下展，内容自适应高度，无内部滚动 -->
      <div v-if="expanded" class="panel-detail">
        <section class="exp-section">
          <h3 class="sec-title">基础信息</h3>
          <div class="field-row"><span class="field-name">章节</span><span class="field-value">{{ barTitle }}</span></div>
          <div v-if="data.mode === 'pov'" class="field-row">
            <span class="field-name">场景编号</span><span class="field-value">{{ data.current_scene }} / 150</span>
          </div>
          <div class="field-row"><span class="field-name">日期</span><span class="field-value">{{ formatDateLabel(data.world.current_date) }}</span></div>
          <div v-if="data.world.time_slot" class="field-row">
            <span class="field-name">时间段</span><span class="field-value">{{ data.world.time_slot }}</span>
          </div>
        </section>

        <section class="exp-section">
          <h3 class="sec-title">场景信息</h3>
          <div class="field-row"><span class="field-name">位置</span><span class="field-value">{{ data.world.current_location }}</span></div>
        </section>

        <section class="exp-section">
          <h3 class="sec-title">玩家信息</h3>
          <div class="field-row"><span class="field-name">扮演</span><span class="field-value">{{ playerLabel(data) }}</span></div>
          <div class="field-row"><span class="field-name">金钱</span><span class="field-value">{{ cashLabel(data.player.cash) }}</span></div>
          <div class="field-row">
            <span class="field-name">持有</span>
            <span class="field-value">{{ data.player.carried_items.length ? data.player.carried_items.join('、') : '无' }}</span>
          </div>
        </section>

        <section v-if="characters.length" class="exp-section">
          <h3 class="sec-title">在场角色</h3>
          <button
            v-for="character in characters"
            :key="character.key"
            type="button"
            class="char-row"
            :title="`${character.displayName} · 查看详情`"
            @click="openChar(character.key)"
          >
            <span class="row-avatar">
              <img v-if="character.portraitUrl" :src="character.portraitUrl" :alt="character.displayName" loading="lazy" />
              <span v-else class="chip-initial">{{ character.displayName.slice(0, 1) }}</span>
            </span>
            <span class="row-main">
              <span class="row-name">{{ character.displayName }}</span>
              <span class="row-label">{{ character.label }}</span>
              <span class="row-summary">{{ statusSummaryOf(character) }}</span>
            </span>
          </button>
        </section>

        <section v-if="data.branch_choice || isLaffPov" class="exp-section">
          <h3 class="sec-title">其他场景变量</h3>
          <div v-if="data.branch_choice" class="field-row">
            <span class="field-name">尾声分支</span><span class="field-value">{{ data.branch_choice }}</span>
          </div>
          <LaffResonance v-if="isLaffPov" :omega="data['Ω_resonance']" :hammers="hammers" />
        </section>
      </div>
    </template>
  </div>

  <!-- 角色详情弹窗（宿主遮罩承载、页面中央；mock 预览时内联全屏遮罩） -->
  <div
    v-else
    class="modal-root"
    :class="{ 'inline-overlay': inlineOverlay }"
    @click.self="closeModal"
  >
    <div class="modal-card">
      <header class="modal-titlebar">
        <span class="modal-title">{{ modalCharacter ? modalCharacter.displayName : '角色详情' }}</span>
        <button type="button" class="modal-close" title="关闭" @click="closeModal">✕</button>
      </header>
      <div class="modal-body">
        <CharacterModal v-if="modalCharacter" :character="modalCharacter" />
        <div v-else class="not-started">该角色当前不在场或尚未认识</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CharacterModal from './components/CharacterModal.vue';
import LaffResonance from './components/LaffResonance.vue';
import { useDataStore } from './store';
import {
  actNameOf,
  cashLabel,
  formatDateLabel,
  hammerViews,
  playerLabel,
  presentCharacters,
  type PresentCharacterView,
} from './utils';

const store = useDataStore();
const data = computed(() => store.data);

const characters = computed(() => presentCharacters(data.value));
const hammers = computed(() => hammerViews(data.value));

const barTitle = computed(() =>
  data.value.mode === 'pov' ? actNameOf(data.value.current_scene) : 'Counterfeit · 自建开放世界',
);
const isLaffPov = computed(() => data.value.mode === 'pov' && data.value.current_pov === 'laff');

/** 在场角色一句状态摘要：内心独白优先，其次最近记忆，都没有则省略号 */
function statusSummaryOf(character: PresentCharacterView): string {
  const text = character.innerThought || character.memory || '……';
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
}

// 楼层面板展开状态（内联，不走宿主弹窗）
const expanded = ref(false);

// 角色弹窗标记：挂载器开满屏 iframe 时置 __counterfeitModalChar 为角色规范名
const hostChar = ((window as any).__counterfeitModalChar as string | null | undefined) ?? null;
// mock 预览降级：没有宿主弹窗管理器时，在页面内联展开
const localChar = ref<string | null>(null);

const view = computed<'panel' | 'char'>(() => (hostChar || localChar.value ? 'char' : 'panel'));
const inlineOverlay = computed(() => !hostChar && localChar.value !== null);

const modalCharKey = computed(() => hostChar ?? localChar.value);
const modalCharacter = computed(() => characters.value.find(character => character.key === modalCharKey.value) ?? null);

interface HostModalApi {
  __counterfeitStatusOpenChar?: (floor: number, charKey: string) => void;
  __counterfeitStatusClose?: () => void;
}

function hostApi(): HostModalApi | null {
  try {
    const host = window.parent as unknown as HostModalApi;
    if (host && host !== (window as unknown)) {
      return host;
    }
  } catch {
    // 跨域时走内联降级
  }
  return null;
}

function openChar(charKey: string) {
  const host = hostApi();
  if (host && typeof host.__counterfeitStatusOpenChar === 'function') {
    host.__counterfeitStatusOpenChar(getCurrentMessageId(), charKey);
    return;
  }
  localChar.value = charKey;
}

function closeModal() {
  if (hostChar) {
    const host = hostApi();
    if (host && typeof host.__counterfeitStatusClose === 'function') {
      host.__counterfeitStatusClose();
    }
    return;
  }
  localChar.value = null;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeModal();
  }
}
window.addEventListener('keydown', onKeydown);
</script>

<style scoped>
/* —— 楼层摘要卡片（宽度跟随正文区域） —— */
.status-panel {
  width: 86%;
  max-width: 720px;
  margin: 12px auto;
  padding: 12px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-top: 3px solid var(--c-primary-soft);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  font-size: 14px;
  line-height: 1.7;
}

.not-started {
  text-align: center;
  color: var(--c-text-muted);
  letter-spacing: 1px;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
}

.head-title {
  color: var(--c-primary-strong);
  font-weight: 600;
}

.head-scene {
  white-space: nowrap;
  color: var(--c-text-muted);
}

.head-scene b {
  color: var(--c-text-strong);
}

.scene-total {
  color: var(--c-text-muted);
}

.head-date {
  color: var(--c-text-muted);
  overflow-wrap: anywhere;
}

.head-expand {
  margin-left: auto;
  flex: none;
  padding: 0 12px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-chip);
  color: var(--c-primary-strong);
  font-size: 13px;
  line-height: 1.9;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.head-expand:hover {
  background: var(--c-surface-muted);
}

.panel-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
}

.sub-field {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.field-name {
  flex: none;
  color: var(--c-text-muted);
  font-size: 13px;
}

.field-value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

/* 在场角色头像标签（立绘裁头像） */
.panel-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.char-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 5px 6px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface-muted);
  text-align: left;
  user-select: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.char-chip:hover {
  border-color: var(--c-primary-soft);
  background: var(--c-surface);
}

.chip-avatar {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.chip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.chip-main {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.chip-name {
  font-weight: 600;
  white-space: nowrap;
}

.chip-label {
  font-size: 13px;
  color: var(--c-primary-strong);
  white-space: nowrap;
}

.chip-initial {
  font-weight: 700;
}

/* —— 内联展开区：内容自适应高度，禁止内部滚动 —— */
.panel-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: auto;
  max-height: none;
  overflow: visible;
  border-top: 1px dashed var(--c-border);
  padding-top: 14px;
}

.exp-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-muted);
  letter-spacing: 2px;
  border-bottom: 1px dashed var(--c-border);
  padding-bottom: 4px;
}

.field-row {
  display: flex;
  gap: 14px;
}

.field-row .field-name {
  width: 4.5em;
}

/* 在场角色行：小头像 + 姓名 + 关系 + 一句摘要 */
.char-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: 9px;
  text-align: left;
  user-select: none;
  transition: background 0.15s ease;
}

.char-row:hover {
  background: var(--c-surface-muted);
}

.row-avatar {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.row-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.row-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  min-width: 0;
}

.row-name {
  font-weight: 600;
}

.row-label {
  color: var(--c-primary-strong);
  font-size: 13px;
  white-space: nowrap;
}

.row-summary {
  color: var(--c-text-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* —— 角色详情弹窗 —— */
.modal-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 16px;
}

.modal-root.inline-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(60, 40, 52, 0.45);
  min-height: 0;
}

.modal-card {
  width: min(860px, 80vw);
  max-width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-top: 3px solid var(--c-primary-soft);
  border-radius: var(--radius-card);
  box-shadow: 0 8px 32px rgba(90, 60, 75, 0.25);
  font-size: 15px;
  line-height: 1.7;
  overflow: hidden;
}

.modal-titlebar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-surface-muted);
}

.modal-title {
  font-weight: 600;
  color: var(--c-text-strong);
  font-size: 16px;
}

.modal-close {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: var(--c-text-muted);
  font-size: 15px;
  line-height: 30px;
  text-align: center;
  transition: background 0.15s ease;
}

.modal-close:hover {
  background: var(--c-surface);
  color: var(--c-text-strong);
}

/* 弹窗唯一滚动区域：视口高度不足时由这里滚动 */
.modal-body {
  overflow-y: auto;
  padding: 18px 20px 20px;
}

/* 窄屏：面板铺满楼层宽度；弹窗占满视口宽度 */
@media (max-width: 480px) {
  .status-panel {
    width: 100%;
    margin: 8px auto;
    padding: 10px 14px 12px;
  }

  .head-date {
    flex-basis: 100%;
  }

  .modal-card {
    width: 100%;
  }

  .modal-root {
    padding: 2vh 8px;
  }
}
</style>
