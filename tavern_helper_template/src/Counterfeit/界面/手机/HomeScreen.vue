<template>
  <div class="home-screen" :style="bgStyle">
    <div v-if="store.wallpaper.type !== 'default'" class="wallpaper-scrim"></div>

    <!-- 日期小组件 -->
    <div class="widget">
      <span class="widget-act">{{ actText }}</span>
      <span class="widget-date">{{ dateText }}</span>
      <span class="widget-scene">{{ sceneText }}</span>
    </div>

    <!-- 应用网格 -->
    <div class="app-grid">
      <button v-for="app in GRID_APPS" :key="app.id" class="app-icon" @click="store.openApp(app.id)">
        <span class="icon-tile" :style="{ background: app.tint }">
          <i :class="app.icon"></i>
          <span v-if="app.id === 'messages' && store.unreadTotal > 0" class="badge">{{ store.unreadTotal }}</span>
        </span>
        <span class="icon-label">{{ app.label }}</span>
      </button>
    </div>

    <!-- Dock -->
    <div class="dock">
      <button v-for="app in DOCK_APPS" :key="app.id" class="app-icon" @click="store.openApp(app.id)">
        <span class="icon-tile" :style="{ background: app.tint }">
          <i :class="app.icon"></i>
          <span v-if="app.id === 'messages' && store.unreadTotal > 0" class="badge">{{ store.unreadTotal }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_HOME_BG, DOCK_APPS, GRID_APPS } from './apps';
import { actNameOf, assetUrl, cnDate } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();

/** 旧版自建（无参与方式）不接入主线：场景号冻结为 1，幕表失真，按开放世界样式展示 */
const legacyCustom = computed(() => store.snapshot.mode === 'custom' && !store.snapshot.hasParticipation);
const actText = computed(() =>
  store.snapshot.mode === 'free' || legacyCustom.value ? '开放世界' : actNameOf(store.snapshot.scene) || 'Counterfeit',
);
const dateText = computed(() => (store.snapshot.date ? cnDate(store.snapshot.date) : '手机助手'));
const sceneText = computed(() => {
  if (store.snapshot.mode === 'free' || legacyCustom.value) {
    const parts = [store.snapshot.timeSlot, store.snapshot.location].filter(Boolean);
    return parts.length ? parts.join(' · ') : '自由行动';
  }
  return store.snapshot.scene != null ? `场景 ${store.snapshot.scene}` : '轻点图标开始';
});

const bgStyle = computed(() => {
  const w = store.wallpaper;
  if (w.type === 'preset') {
    return { backgroundImage: `url('${assetUrl(w.value)}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (w.type === 'custom') {
    return { backgroundImage: `url('${w.value}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundImage: DEFAULT_HOME_BG, backgroundSize: 'cover', backgroundPosition: 'center' };
});
</script>

<style lang="scss" scoped>
.home-screen {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 22px 10px;
  background-color: #241d2c;
}

.wallpaper-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.38));
  pointer-events: none;
}

.widget,
.app-grid,
.dock {
  position: relative;
  z-index: 1;
}

.widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 18px 0 22px;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}

.widget-act {
  font-size: 12px;
  letter-spacing: 2px;
  opacity: 0.75;
}

.widget-date {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 1px;
}

.widget-scene {
  font-size: 12px;
  opacity: 0.75;
  letter-spacing: 2px;
}

.app-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-content: start;
  row-gap: 20px;
}

.app-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.9);
  }
}

.icon-tile {
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 22%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
}

.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: #ff3b30;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.icon-label {
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.dock {
  margin: 0 -8px;
  padding: 12px 18px 14px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
  display: flex;
  justify-content: space-around;

  .icon-tile {
    width: 54px;
    height: 54px;
  }
}
</style>
