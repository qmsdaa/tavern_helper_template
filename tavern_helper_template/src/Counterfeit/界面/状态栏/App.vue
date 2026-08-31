<template>
  <!-- 楼层内：紧凑摘要卡片（章节/场景/日期 + 位置/扮演 + 在场角色头像），点头像走宿主顶层弹窗 -->
  <div v-if="view === 'panel'" class="status-panel">
    <div v-if="!data.mode" class="not-started">🌸 Counterfeit · 尚未选择模式，请在开场白界面完成开局</div>
    <template v-else>
      <!-- 第一行：章节 / 场景编号 / 日期 / 星期 -->
      <div class="panel-head">
        <span class="head-title">🌸 {{ barTitle }}</span>
        <span v-if="storyProgress" class="head-scene">
          场景 <b>{{ data.current_scene }}</b><span class="scene-total"> / {{ mainTotal }}</span>
        </span>
        <span class="head-date">{{ formatDateLabel(data.world.current_date) }}</span>
      </div>
      <!-- 第二行：位置 / 扮演角色 / 时段（free 模式） -->
      <div class="panel-sub">
        <span class="sub-field">
          <span class="field-name">位置</span><span class="field-value">{{ data.world.current_location }}</span>
        </span>
        <span class="sub-field">
          <span class="field-name">扮演</span>
          <span class="field-value">{{ playerLabel(data) }}</span>
          <span v-if="genderbend" class="gb-badge" title="DLC《错位的日常》专属角色 · 比企谷八幡（性转）">性转</span>
        </span>
        <span v-if="data.mode === 'free' && data.world.time_slot" class="sub-field">
          <span class="field-name">时段</span><span class="field-value">{{ data.world.time_slot }}</span>
        </span>
        <span v-if="identityText" class="sub-field identity-field">
          <span class="field-name">身份</span><span class="field-value">{{ identityText }}</span>
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
            <img
              v-if="character.avatarUrl"
              :src="character.avatarUrl"
              :alt="character.displayName"
              loading="lazy"
              decoding="async"
            />
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
        <!-- 主题切换：原生 details 承载下拉，无 JS 定位、无固定高度；
             选择落 localStorage，实时同步到所有楼层与弹窗（theme.ts） -->
        <details ref="themeMenu" class="theme-menu">
          <summary class="theme-trigger" :title="`主题：${themeLabel}`">
            <span class="theme-icon" aria-hidden="true">◐</span>
            <span class="theme-current">{{ themeLabel }}</span>
          </summary>
          <div class="theme-list">
            <button
              v-for="option in THEMES"
              :key="option.name"
              type="button"
              class="theme-item"
              :class="{ active: option.name === theme }"
              @click="pickTheme(option.name)"
            >
              <span class="theme-item-label">{{ option.label }}</span>
              <span class="theme-item-hint">{{ option.hint }}</span>
              <span v-if="option.name === theme" class="theme-item-check" aria-hidden="true">✓</span>
            </button>
          </div>
        </details>
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
import { campaignRegistry } from '../../generated/scene-index';
import { useDataStore } from './store';
import { THEMES, currentTheme, onThemeChange, setTheme, type ThemeName } from './theme';
import {
  actNameOf,
  campaignTitle,
  formatDateLabel,
  identityBadge,
  isGenderbendHachiman,
  isStoryProgress,
  playerLabel,
  presentCharacters,
} from './utils';

const store = useDataStore();
const data = computed(() => store.data);
const mainTotal = campaignRegistry.main.total_scenes;

const characters = computed(() => presentCharacters(data.value));

const storyProgress = computed(() => isStoryProgress(data.value));
const barTitle = computed(() => {
  if (storyProgress.value) return actNameOf(data.value.current_scene);
  return campaignTitle(data.value);
});
const identityText = computed(() => identityBadge(data.value));
const genderbend = computed(() => isGenderbendHachiman(data.value));

// 角色弹窗标记：挂载器开顶层弹窗 iframe 时置 __counterfeitModalChar 为角色规范名
const hostChar = ((window as any).__counterfeitModalChar as string | null | undefined) ?? null;
// mock 预览降级：没有宿主弹窗管理器时，在页面内联展开
const localChar = ref<string | null>(null);

// 宿主顶层弹窗（fill）模式：整链改用百分比高度（global.css · html.cf-modal-fill），
// 不依赖 iframe 内的 100vh/100dvh——部分移动端内核对 srcdoc iframe 的视口单位计算不可靠
if (hostChar !== null) {
  document.documentElement.classList.add('cf-modal-fill');
}

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
  const floor = typeof getCurrentMessageId === 'function' ? getCurrentMessageId() : null;
  if (postToHost({ type: 'open-char', floor, key: charKey })) return;
  localChar.value = charKey;
}

function closeModal() {
  if (hostChar) {
    postToHost({ type: 'close-modal' });
    return;
  }
  localChar.value = null;
}

// —— 主题切换（弹窗标题栏）——
// 选择记在 localStorage：srcdoc iframe 与宿主同源共享，故楼层摘要与弹窗看到同一份；
// 其它 iframe 通过 storage 事件实时同步（theme.ts），不需要刷新。
const themeMenu = ref<HTMLDetailsElement | null>(null);
const theme = ref<ThemeName>(currentTheme());
const themeLabel = computed(() => THEMES.find(option => option.name === theme.value)?.label ?? '樱白');

// 其它楼层/弹窗改了主题 → 同步本组件的选中态显示
onThemeChange(name => {
  theme.value = name;
});

function closeThemeMenu() {
  if (themeMenu.value) themeMenu.value.open = false;
}

function pickTheme(name: ThemeName) {
  setTheme(name);
  theme.value = name;
  closeThemeMenu();
}

/** 点菜单外部收起下拉（不用遮罩层，避免多一层盒子影响弹窗高度链） */
function onDocPointerDown(event: Event) {
  const menu = themeMenu.value;
  if (!menu || !menu.open) return;
  const target = event.target as Node | null;
  if (target && !menu.contains(target)) closeThemeMenu();
}
document.addEventListener('pointerdown', onDocPointerDown, true);

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // Esc 先收主题下拉，再次按下才关弹窗
  if (themeMenu.value && themeMenu.value.open) {
    closeThemeMenu();
    return;
  }
  closeModal();
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

/* 性转八幡专属徽章：DLC《错位的日常》独立角色独特标识（区别于主线男性八幡） */
.gb-badge {
  flex: none;
  align-self: center;
  padding: 1px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, #f0679f, #b974d8);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  line-height: 1.6;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgb(240 103 159 / .35);
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
  color: var(--c-on-primary);
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
  background: var(--c-scrim);
  min-height: 0;
}

/* 宿主顶层弹窗模式：窗口尺寸由挂载脚本遮罩给定（90vw×86dvh·max 1150px），本 iframe 填满；
   高度整链走百分比（html.cf-modal-fill → body → #app → 本元素 → 卡片），不依赖 iframe 内视口单位 */
/* fill 模式绝不能出现 vh：部分移动端内核把 srcdoc iframe 内的 100vh 算成外层视口高度，
   于是卡片被撑到比 iframe 本身还高，超出部分被桥接注入的 overflow:hidden 直接裁掉（且无法滚动）——
   表现就是标题栏与立绘上半身被切在视口外。高度整链只走百分比（html.cf-modal-fill → body → #app → 本元素）。 */
.modal-root.fill {
  min-height: 0;
  height: 100%;
  padding: 0;
  display: block;
  overflow: hidden;
}

.modal-root.fill .modal-card {
  width: 100%;
  height: 100%;
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
  box-shadow: var(--shadow-modal);
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
  flex: none;
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

/* —— 主题切换下拉 ——
   原生 <details>：触发钮在标题栏内（flex:none，不改标题栏高度），
   列表 position:absolute 脱离文档流向下浮出，因此展开与否都不影响
   标题栏/卡片/modal-body 的高度链——2026-08-05 的移动端修复不受影响。
   列表向下展开进卡片内部（卡片 overflow:hidden 只裁越出卡片外的部分），
   最小可见高 450px 档下实测未越界。 */
.theme-menu {
  position: relative;
  flex: none;
  margin-left: auto;
}

.theme-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-text-muted);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  white-space: nowrap;
}

.theme-trigger::-webkit-details-marker {
  display: none;
}

.theme-trigger:hover {
  border-color: var(--c-primary-soft);
  color: var(--c-text-strong);
}

.theme-icon {
  font-size: 14px;
  line-height: 1;
}

.theme-list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 168px;
  display: flex;
  flex-direction: column;
  padding: 6px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface);
  box-shadow: var(--shadow-modal);
}

/* 触控目标 44px；选中项用主色底 + ✓ 双重标识（不只靠颜色） */
.theme-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 10px;
  border-radius: 7px;
  color: var(--c-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.theme-item:hover {
  background: var(--c-surface-muted);
}

.theme-item.active {
  background: var(--c-primary-soft);
  color: var(--c-primary-strong);
  font-weight: 600;
}

.theme-item-label {
  flex: none;
}

.theme-item-hint {
  flex: 1;
  min-width: 0;
  color: var(--c-text-muted);
  font-size: 12px;
}

.theme-item.active .theme-item-hint {
  color: var(--c-primary-strong);
}

.theme-item-check {
  flex: none;
  font-size: 13px;
}

/* 弹窗唯一滚动区域：视口高度不足时由这里滚动；
   flex:1 + min-height:0 显式声明收缩，防止部分移动端内核 flex 布局把内容裁掉而不是滚动 */
.modal-body {
  flex: 1;
  min-height: 0;
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
