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
        <WallpaperApp v-else-if="store.currentApp === 'wallpaper'" />
        <SettingsApp v-else-if="store.currentApp === 'settings'" />
        <PlaceholderApp v-else :app-id="store.currentApp" />
      </PhoneFrame>
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
import { usePhoneStore } from './store';

const store = usePhoneStore();

/** 嵌入模式：被酒馆加载器以 srcdoc iframe 挂载 */
const embedded = window.parent !== window;

onMounted(() => {
  store.armMainlineBridge();
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
