<template>
  <div class="phone-body">
    <!-- 侧边按键 -->
    <span class="side-btn side-btn--silent"></span>
    <span class="side-btn side-btn--vol-up"></span>
    <span class="side-btn side-btn--vol-down"></span>
    <span class="side-btn side-btn--power"></span>

    <div class="phone-screen">
      <!-- 状态栏 -->
      <div class="status-bar">
        <span class="status-date">{{ statusText }}</span>
        <span class="status-icons">
          <i class="fa-solid fa-signal"></i>
          <i class="fa-solid fa-wifi"></i>
          <i class="fa-solid fa-battery-three-quarters"></i>
        </span>
      </div>

      <!-- Dynamic Island -->
      <div class="dynamic-island"></div>

      <!-- 屏幕内容 -->
      <div class="screen-content">
        <slot></slot>
      </div>

      <!-- Home 指示条（点击回主屏幕） -->
      <button class="home-indicator" title="回主屏幕" @click="store.goHome()">
        <span></span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cnDate } from './vars';
import { usePhoneStore } from './store';

const store = usePhoneStore();

const statusText = computed(() => {
  const date = store.snapshot.date;
  return date ? cnDate(date) : '手机助手';
});
</script>

<style lang="scss" scoped>
.phone-body {
  position: relative;
  width: 392px;
  height: 820px;
  max-height: calc(100vh - 40px);
  padding: 12px;
  border-radius: 54px;
  background: linear-gradient(160deg, var(--c-phone-frame-hi), var(--c-phone-frame) 30%, #17171b);
  box-shadow:
    var(--shadow-phone),
    inset 0 1px 2px rgba(255, 255, 255, 0.25),
    inset 0 -1px 2px rgba(0, 0, 0, 0.5);
}

/* 侧边按键 */
.side-btn {
  position: absolute;
  width: 3px;
  border-radius: 2px;
  background: #3d3d45;

  &--silent {
    left: -2px;
    top: 110px;
    height: 26px;
  }
  &--vol-up {
    left: -2px;
    top: 160px;
    height: 44px;
  }
  &--vol-down {
    left: -2px;
    top: 214px;
    height: 44px;
  }
  &--power {
    right: -2px;
    top: 170px;
    height: 64px;
  }
}

.phone-screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 42px;
  background: var(--c-phone-screen);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text);
  position: relative;
  z-index: 5;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.dynamic-island {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 118px;
  height: 30px;
  border-radius: 20px;
  background: #000;
  z-index: 10;
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #1a1a2e;
    box-shadow: inset 0 0 2px rgba(90, 120, 200, 0.6);
  }
}

.screen-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.home-indicator {
  flex: none;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  position: relative;
  z-index: 5;

  span {
    width: 134px;
    height: 5px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.75);
    transition: opacity 0.2s ease;
  }

  &:hover span {
    opacity: 0.6;
  }
}
</style>
