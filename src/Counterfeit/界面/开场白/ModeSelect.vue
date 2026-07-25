<template>
  <div class="mode-select">
    <h2 class="screen-title">选择你的视角</h2>

    <div class="pov-grid">
      <button
        v-for="pov in POV_LIST"
        :key="pov.key"
        class="pov-card card"
        :class="{ selected: store.selectedPov === pov.key }"
        @click="store.selectPov(pov.key)"
      >
        <span v-if="store.selectedPov === pov.key" class="check-badge">
          <i class="fa-solid fa-check"></i>
        </span>
        <div class="portrait-box">
          <img :src="portraitUrl(pov.portrait)" :alt="pov.name" draggable="false" />
        </div>
        <div class="pov-info">
          <span class="pov-name">{{ pov.name }}</span>
          <span class="pov-role">{{ pov.role }}</span>
          <span class="pov-conflict">{{ pov.tagline }}</span>
        </div>
      </button>

      <!-- 自建角色 -->
      <button class="pov-card card custom-card" @click="store.toCustom()">
        <div class="portrait-box custom-box">
          <i class="fa-solid fa-plus"></i>
        </div>
        <div class="pov-info">
          <span class="pov-name">自建角色</span>
          <span class="pov-conflict">创建属于你的主角</span>
        </div>
      </button>
    </div>

    <div class="footer">
      <button class="btn-ghost" @click="store.backToTitle()">
        <i class="fa-solid fa-arrow-left"></i> 返回标题
      </button>
      <button class="btn-primary next-btn" :disabled="!store.selectedPov" @click="store.confirmPov()">
        下一步 <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { POV_LIST } from './copy';
import { portraitUrl } from './data';
import { useOpeningStore } from './store';

const store = useOpeningStore();
</script>

<style lang="scss" scoped>
.mode-select {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 40px;
}

.screen-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 4px;
  color: var(--c-text);
  margin-bottom: 24px;
}

.pov-grid {
  width: 100%;
  max-width: 480px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.pov-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid transparent;
  padding: 0;
  text-align: center;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-float);
  }

  &.selected {
    border-color: var(--c-primary);
    box-shadow: var(--shadow-float);
  }
}

.check-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--grad-primary);
  color: var(--c-text-inverse);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portrait-box {
  height: 190px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(180deg, var(--c-surface) 0%, var(--c-bg-deep) 100%);
  overflow: hidden;

  img {
    height: 180px;
    width: auto;
    object-fit: contain;
    object-position: bottom;
    user-select: none;
  }
}

.custom-card {
  border: 2px dashed var(--c-border-strong);

  &:hover {
    border-color: var(--c-primary);
  }
}

.custom-box {
  background: var(--c-surface-muted);
  color: var(--c-primary);
  font-size: 40px;
  align-items: center;
}

.pov-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px 14px;
}

.pov-name {
  font-size: 16px;
  font-weight: 700;
}

.pov-role {
  display: inline-block;
  align-self: center;
  padding: 2px 10px;
  border-radius: var(--radius-button);
  background: var(--c-primary-soft);
  color: var(--c-primary-strong);
  font-size: 12px;
  font-weight: 600;
}

.pov-conflict {
  font-size: 12px;
  color: var(--c-text-muted);
  line-height: 1.5;
}

.footer {
  margin-top: 28px;
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.next-btn {
  padding: 12px 28px;
  font-size: 15px;
}
</style>
