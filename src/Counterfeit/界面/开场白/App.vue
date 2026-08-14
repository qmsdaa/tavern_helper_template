<template>
  <div class="opening-root">
    <Transition name="fade" mode="out-in">
      <GateScreen v-if="store.step === 'gate'" key="gate" />
      <IntroSequence v-else-if="store.step === 'intro'" key="intro" />
      <TitleScreen v-else-if="store.step === 'title'" key="title" />
      <GalleryScreen v-else-if="store.step === 'gallery'" key="gallery" />
      <CampaignSelect v-else-if="store.step === 'campaign'" key="campaign" />
      <ModeSelect v-else-if="store.step === 'mode'" key="mode" />
      <PovConfirm v-else-if="store.step === 'pov'" key="pov" />
      <CustomForm v-else-if="store.step === 'custom'" key="custom" />
      <DlcSetup v-else-if="store.step === 'dlc_setup'" key="dlc-setup" />
      <SaveImportScreen v-else-if="store.step === 'save_import'" key="save-import" />
      <OpeningText v-else-if="store.step === 'opening'" key="opening" />

      <!-- 完成态：预览模式的确认页；酒馆环境中界面通常已随楼层刷新卸载，此为兜底 -->
      <div v-else key="done" class="done-screen">
        <div class="done-card card">
          <i class="fa-solid fa-circle-check done-icon"></i>
          <h2 class="done-title">
            {{ store.previewMode ? '✅ 已提交（预览模式）' : '✅ 已写入开场白' }}
          </h2>
          <p v-if="store.previewMode" class="done-hint">
            当前为纯浏览器预览，完整 payload 已输出到 console（F12 查看）。
          </p>
          <pre class="done-summary">{{ store.committedSummary }}</pre>
        </div>
      </div>
    </Transition>

    <!-- 全局 toast -->
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast-${item.type}`">
          <i
            class="fa-solid"
            :class="{
              'fa-circle-info': item.type === 'info',
              'fa-circle-check': item.type === 'success',
              'fa-circle-exclamation': item.type === 'error',
            }"
          ></i>
          <span>{{ item.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import CustomForm from './CustomForm.vue';
import CampaignSelect from './CampaignSelect.vue';
import DlcSetup from './DlcSetup.vue';
import GalleryScreen from './GalleryScreen.vue';
import GateScreen from './GateScreen.vue';
import IntroSequence from './IntroSequence.vue';
import ModeSelect from './ModeSelect.vue';
import OpeningText from './OpeningText.vue';
import PovConfirm from './PovConfirm.vue';
import SaveImportScreen from './SaveImportScreen.vue';
import TitleScreen from './TitleScreen.vue';
import { useOpeningStore } from './store';
import { useToasts } from './toast';

const store = useOpeningStore();
const toasts = useToasts();
</script>

<style lang="scss" scoped>
.opening-root {
  min-height: 100vh;
  min-height: 100dvh;
}

.done-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.done-card {
  width: 100%;
  max-width: 480px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.done-icon {
  font-size: 44px;
  color: var(--c-success);
}

.done-title {
  font-size: 20px;
  font-weight: 800;
}

.done-hint {
  font-size: 13px;
  color: var(--c-text-muted);
}

.done-summary {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  background: var(--c-surface-muted);
  border: 1px solid var(--c-border);
  font-size: 12px;
  line-height: 1.7;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--c-text-muted);
}

.toast-container {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: min(92vw, 420px);
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-button);
  background: var(--c-surface);
  box-shadow: var(--shadow-float);
  font-size: 13px;
  color: var(--c-text);
  border: 1px solid var(--c-border);

  &.toast-success i {
    color: var(--c-success);
  }

  &.toast-error i {
    color: var(--c-danger);
  }

  &.toast-info i {
    color: var(--c-primary);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
