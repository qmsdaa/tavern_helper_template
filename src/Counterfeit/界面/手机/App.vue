<template>
  <!-- 悬浮启动器（仅独立预览时渲染；嵌入酒馆时由加载器提供） -->
  <button v-if="!embedded && !store.isOpen" class="launcher" title="打开手机助手" @click="store.open()">
    <i class="fa-solid fa-mobile-screen-button"></i>
    <span class="launcher-pulse"></span>
  </button>

  <!-- 手机本体 -->
  <Transition name="phone">
    <div v-if="store.isOpen" class="phone-overlay" @click.self="store.close()">
      <PhoneFrame>
        <HomeScreen v-if="store.currentApp === 'home'" />
        <StatusApp v-else-if="store.currentApp === 'status'" />
        <MessagesApp v-else-if="store.currentApp === 'messages'" />
        <FriendsApp v-else-if="store.currentApp === 'friends'" />
        <ScenesApp v-else-if="store.currentApp === 'scenes'" />
        <CgApp v-else-if="store.currentApp === 'cg'" />
        <MapApp v-else-if="store.currentApp === 'map'" />
        <ForumApp v-else-if="store.currentApp === 'forum'" />
        <RequestsApp v-else-if="store.currentApp === 'requests'" />
        <DbSheetApp v-else-if="store.currentApp === 'archive'" title="纪要" kind="summary" :sheet-candidates="SHEET_SUMMARY" />
        <DbSheetApp v-else-if="store.currentApp === 'diary'" title="恋爱日记" kind="diary" :sheet-candidates="SHEET_ROMANCE_DIARY" />
        <DbSheetApp v-else-if="store.currentApp === 'memo'" title="备忘录" kind="memo" :sheet-candidates="SHEET_MEMO" />
        <DbSheetApp v-else-if="store.currentApp === 'inventory'" title="物品" kind="inventory" :sheet-candidates="SHEET_INVENTORY" />
        <DbSheetApp v-else-if="store.currentApp === 'profiles'" title="角色档案" kind="character" :sheet-candidates="SHEET_CHARACTERS" />
        <WallpaperApp v-else-if="store.currentApp === 'wallpaper'" />
        <SettingsApp v-else-if="store.currentApp === 'settings'" />
        <PlaceholderApp v-else :app-id="store.currentApp" />
      </PhoneFrame>

      <!-- 自动保存状态提示（不只写 console） -->
      <Transition name="save-fade">
        <div v-if="saveChipVisible" class="save-chip" :class="store.saveState">
          <i class="fa-solid" :class="chipIcon"></i>
          <span>{{ chipText }}</span>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import HomeScreen from './HomeScreen.vue';
import MessagesApp from './MessagesApp.vue';
import PhoneFrame from './PhoneFrame.vue';
import PlaceholderApp from './PlaceholderApp.vue';
import StatusApp from './StatusApp.vue';
import WallpaperApp from './WallpaperApp.vue';
import FriendsApp from './FriendsApp.vue';
import ScenesApp from './ScenesApp.vue';
import CgApp from './CgApp.vue';
import SettingsApp from './SettingsApp.vue';
import MapApp from './MapApp.vue';
import ForumApp from './ForumApp.vue';
import RequestsApp from './RequestsApp.vue';
import DbSheetApp from './DbSheetApp.vue';
import { SHEET_INVENTORY, SHEET_MEMO, SHEET_ROMANCE_DIARY, SHEET_SUMMARY, SHEET_CHARACTERS } from './shujuku';
import { usePhoneStore } from './store';

const store = usePhoneStore();

/** 嵌入模式：被酒馆加载器以 srcdoc iframe 挂载 */
const embedded = window.parent !== window;

// 手机脚本初始化即自动挂载主线桥（不要求玩家先打开一次手机界面；幂等 + 有界重试）
store.armMainlineBridge();

/* —— 自动保存提示 —— */

const saveChipVisible = ref(false);
let saveChipTimer: number | null = null;

const chipIcon = computed(() =>
  store.saveState === 'saving'
    ? 'fa-circle-notch fa-spin'
    : store.saveState === 'error'
      ? 'fa-triangle-exclamation'
      : 'fa-circle-check',
);
const chipText = computed(() => {
  if (store.saveState === 'saving') return '正在保存…';
  if (store.saveState === 'error') return `保存失败：${store.saveError || '未知错误'}`;
  if (store.saveState === 'saved' && store.lastSavedAt) {
    return `已自动保存 · ${new Date(store.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return '已自动保存';
});

watch(
  () => store.saveState,
  state => {
    if (state === 'idle') return;
    saveChipVisible.value = true;
    if (saveChipTimer !== null) window.clearTimeout(saveChipTimer);
    saveChipTimer = window.setTimeout(() => {
      saveChipVisible.value = false;
    }, 2600);
  },
);

onMounted(() => {
  void store.refreshPersonas();
});

function postVisibility(open: boolean) {
  if (embedded) {
    window.parent.postMessage({ source: 'counterfeit-phone', open }, '*');
  }
}

watch(
  () => store.isOpen,
  open => postVisibility(open),
);

if (embedded) {
  // 加载器桥：嵌入模式下 iframe 常驻但默认穿透，由父窗口启动器开关
  document.body.style.background = 'transparent';
  window.addEventListener('message', event => {
    const data = event.data;
    if (data && data.source === 'counterfeit-phone-loader' && data.action === 'open') {
      store.open();
    }
  });
  // 就绪握手：通知加载器 app 已挂载，补发被竞态丢掉的 open
  window.parent.postMessage({ source: 'counterfeit-phone', ready: true }, '*');
}
</script>

<style lang="scss" scoped>
.launcher {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 9990;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: linear-gradient(145deg, #4a4a52, var(--c-launcher));
  color: #fff;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-launcher);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }
}

.launcher-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  animation: launcher-pulse 2.4s ease-out infinite;
  pointer-events: none;
}

@keyframes launcher-pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.phone-overlay {
  position: fixed;
  inset: 0;
  z-index: 9991;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 12, 0.45);
  backdrop-filter: blur(3px);
}

/* 自动保存状态提示 */
.save-chip {
  position: absolute;
  right: 18px;
  top: 64px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 240px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(30, 32, 36, 0.92);
  color: #fff;
  font-size: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);

  &.saving i {
    color: #f0a53a;
  }

  &.error {
    background: rgba(217, 83, 79, 0.95);
  }

  &.saved i {
    color: #5ee08a;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.save-fade-enter-active,
.save-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.save-fade-enter-from,
.save-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.phone-enter-active,
.phone-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.phone-enter-from,
.phone-leave-to {
  opacity: 0;
  transform: translateY(40px) scale(0.92);
}

.phone-enter-to,
.phone-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
