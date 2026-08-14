<template>
  <div class="mode-select">
    <h2 class="screen-title">选择你的视角</h2>

    <div class="game-mode-tabs">
      <button
        v-for="gm in GAME_MODES"
        :key="gm"
        class="gm-tab"
        :class="{ active: store.gameMode === gm }"
        @click="store.gameMode = gm"
      >
        <span class="gm-label">{{ MODE_COPY[gm].label }}</span>
        <span class="gm-desc">{{ MODE_COPY[gm].desc }}</span>
      </button>
    </div>

    <p v-if="store.gameMode === 'story'" class="plugin-warning" role="note">
      <i class="fa-solid fa-triangle-exclamation"></i>
      剧情模式必须安装并启用“提示词模板”插件；否则 <code>@@if</code> 场景门控不会执行，请勿开始生成。
    </p>

    <div class="difficulty-row">
      <span class="diff-title">恋爱难度</span>
      <button
        v-for="d in DIFFICULTY_LIST"
        :key="d"
        class="diff-tab"
        :class="{ active: store.difficulty === d }"
        @click="store.difficulty = d"
      >
        <span class="diff-label">{{ DIFFICULTY_COPY[d].label }}</span>
        <span class="diff-desc">{{ DIFFICULTY_COPY[d].desc }}</span>
      </button>
    </div>

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
import { DIFFICULTY_COPY, DIFFICULTY_LIST, MODE_COPY, POV_LIST } from './copy';
import { portraitUrl } from './data';
import { useOpeningStore, type GameMode } from './store';

const store = useOpeningStore();
const GAME_MODES: GameMode[] = ['story', 'open'];
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

.game-mode-tabs {
  width: 100%;
  max-width: 480px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.plugin-warning {
  width: 100%;
  max-width: 480px;
  margin: -8px 0 16px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--c-warning) 42%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--c-warning) 10%, var(--c-surface));
  color: var(--c-text-muted);
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
}

.plugin-warning i {
  margin-right: 5px;
  color: var(--c-warning);
}

.plugin-warning code {
  color: var(--c-primary-strong);
}

.gm-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &.active {
    border-color: var(--c-primary);
    box-shadow: 0 0 0 1px var(--c-primary);
  }

  &:hover {
    border-color: var(--c-primary);
  }
}

.gm-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text);
  letter-spacing: 2px;
}

.gm-desc {
  font-size: 11px;
  color: var(--c-text-muted);
  text-align: center;
  line-height: 1.5;
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

.difficulty-row {
  width: 100%;
  max-width: 480px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
}

.diff-title {
  font-size: 13px;
  color: var(--c-text-muted);
  letter-spacing: 2px;
  flex-shrink: 0;
}

.diff-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 6px 8px;
  border-radius: 9px;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &.active {
    border-color: var(--c-primary);
    box-shadow: 0 0 0 1px var(--c-primary);
  }

  &:hover {
    border-color: var(--c-primary);
  }
}

.diff-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text);
  letter-spacing: 1px;
}

.diff-desc {
  font-size: 10px;
  color: var(--c-text-muted);
  line-height: 1.4;
  text-align: center;
}
</style>
