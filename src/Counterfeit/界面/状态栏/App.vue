<template>
  <!-- 楼层内：紧凑摘要卡片（章节/场景/日期 + 位置/扮演 + 在场角色头像），点头像走宿主顶层弹窗 -->
  <div v-if="view === 'panel'" class="status-panel">
    <div v-if="!data.mode" class="not-started">🌸 Counterfeit · 尚未选择模式，请在开场白界面完成开局</div>
    <template v-else>
      <!-- 第一行：章节 / 场景编号 / 日期 / 星期 -->
      <div class="panel-head">
        <span class="head-title">🌸 {{ barTitle }}</span>
        <span v-if="data.mode === 'pov'" class="head-scene">
          场景 <b>{{ data.current_scene }}</b><span class="scene-total"> / 150</span>
        </span>
        <span class="head-date">{{ formatDateLabel(data.world.current_date) }}</span>
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
      <!-- 第三行：在场角色头像标签（点击 → postMessage → 宿主顶层角色详情弹窗） -->
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
    </template>
  </div>

  <!-- 角色详情弹窗（宿主顶层遮罩承载并定尺寸，本 iframe 填满弹窗；mock 预览时内联全屏遮罩） -->
  <div
    v-else
    class="modal-root"
    :class="{ 'inline-overlay': inlineOverlay, fill: hostChar !== null }"
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
import { useDataStore } from './store';
import {
  actNameOf,
  formatDateLabel,
  playerLabel,
  presentCharacters,
} from './utils';

const store = useDataStore();
const data = computed(() => store.data);

const characters = computed(() => presentCharacters(data.value));

const barTitle = computed(() =>
  data.value.mode === 'pov' ? actNameOf(data.value.current_scene) : 'Counterfeit · 自建开放世界',
);

// 角色弹窗标记：挂载器开顶层弹窗 iframe 时置 __counterfeitModalChar 为角色规范名
const hostChar = ((window as any).__counterfeitModalChar as string | null | undefined) ?? null;
// mock 预览降级：没有宿主弹窗管理器时，在页面内联展开
const localChar = ref<string | null>(null);

const view = computed<'panel' | 'char'>(() => (hostChar || localChar.value ? 'char' : 'panel'));
const inlineOverlay = computed(() => !hostChar && localChar.value !== null);

const modalCharKey = computed(() => hostChar ?? localChar.value);
const modalCharacter = computed(() => characters.value.find(character => character.key === modalCharKey.value) ?? null);

/** 楼层 iframe 与脚本库沙箱之间只能 postMessage（宿主页转发给挂载脚本监听） */
function postToHost(payload: Record<string, unknown>): boolean {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'counterfeit-statusbar', ...payload }, '*');
      return true;
    }
  } catch {
    // 顶层预览（无父页）时走内联降级
  }
  return false;
}

function openChar(charKey: string) {
  if (hostChar) return;
  if (postToHost({ type: 'open-char', floor: getCurrentMessageId(), key: charKey })) return;
  localChar.value = charKey;
}

function closeModal() {
  if (hostChar) {
    postToHost({ type: 'close-modal' });
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

/* 宿主顶层弹窗模式：窗口尺寸由挂载脚本遮罩给定（90vw×86dvh·max 1150px），本 iframe 填满 */
.modal-root.fill {
  min-height: 100vh;
  padding: 0;
  display: block;
}

.modal-root.fill .modal-card {
  width: 100%;
  height: 100vh;
  max-height: none;
  border: none;
  border-top: 3px solid var(--c-primary-soft);
  border-radius: 0;
  box-shadow: none;
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
