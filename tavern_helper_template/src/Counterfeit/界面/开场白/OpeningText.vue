<template>
  <div class="opening-text">
    <div class="text-card card">
      <div class="text-header">
        <i class="fa-solid fa-book-open"></i>
        <span>序幕{{ store.openingDraft !== null ? '（自定义）' : '' }}</span>
        <button v-if="!editing" class="edit-toggle" @click="startEdit">
          <i class="fa-solid fa-pen"></i>
          编辑文案
        </button>
      </div>

      <!-- 阅读态：展示最终提交的正文（草稿清洗后优先，否则官方默认） -->
      <div v-if="!editing" class="text-body">
        <p v-for="(paragraph, i) in paragraphs" :key="i" class="paragraph" :style="{ animationDelay: 0.4 + i * 0.5 + 's' }">
          {{ paragraph }}
        </p>
        <span class="cursor"></span>
      </div>

      <!-- 编辑态：只修改序幕叙事文字；开局角色/日期/场景/难度不变 -->
      <div v-else class="edit-body">
        <textarea
          v-model="draftInput"
          class="edit-textarea"
          :maxlength="4000"
          rows="12"
          placeholder="在这里写你的序幕…留空保存则恢复官方默认；自由世界模式下序幕会决定开局日期/地点/情境"
        ></textarea>
        <div class="edit-meta">
          <span class="char-count" :class="{ over: overLimit }">{{ draftInput.length }}/{{ maxLen }}</span>
        </div>
        <p v-if="hasMarkers" class="edit-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          检测到结构性标记（&lt;opening_setup&gt; / &lt;UpdateVariable&gt; / &lt;% %&gt; 等），保存时会被安全转义为可见文字
        </p>
        <p class="edit-hint">
          自由世界（开放世界 / DLC）模式下，自定义序幕将决定开局的日期、地点与情境，不再固定默认开场；
          剧本模式仅修改序幕文字，开局角色 / 场景 / 难度不变。草稿只对当前这次新开局生效，不会写入全局存储。
        </p>
        <div class="edit-actions">
          <button class="btn-ghost" :disabled="overLimit" @click="saveEdit">
            <i class="fa-solid fa-check"></i>
            保存
          </button>
          <button class="btn-ghost" @click="cancelEdit">
            <i class="fa-solid fa-xmark"></i>
            取消
          </button>
          <button class="btn-ghost" @click="restoreDefault">
            <i class="fa-solid fa-rotate-left"></i>
            恢复默认
          </button>
        </div>
      </div>

      <button class="btn-primary start-btn" :disabled="store.submitting || editing" @click="store.commit()">
        <i class="fa-solid" :class="store.submitting ? 'fa-spinner fa-spin' : 'fa-play'"></i>
        {{ store.submitting ? '正在写入…' : '开始' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { hasStructuralMarkers, OPENING_DRAFT_MAX } from './openingDraft';
import { useOpeningStore } from './store';
import { showToast } from './toast';

const store = useOpeningStore();

const paragraphs = computed(() => store.finalOpeningText.split('\n').filter(line => line.trim().length > 0));

const editing = ref(false);
const draftInput = ref('');
const maxLen = OPENING_DRAFT_MAX;
const overLimit = computed(() => draftInput.value.length > maxLen);
const hasMarkers = computed(() => hasStructuralMarkers(draftInput.value));

// 进入编辑：预填当前最终正文（已有草稿则继续编辑草稿原文，避免把转义后的文本再次转义）
function startEdit() {
  draftInput.value = store.openingDraft ?? store.finalOpeningText;
  editing.value = true;
}

function saveEdit() {
  if (overLimit.value) return;
  const result = store.applyOpeningDraft(draftInput.value);
  showToast(result.message, result.ok ? 'success' : 'error');
  if (result.ok) editing.value = false;
}

function cancelEdit() {
  editing.value = false;
}

function restoreDefault() {
  store.resetOpeningDraft();
  draftInput.value = '';
  editing.value = false;
  showToast('已恢复官方默认序幕', 'success');
}

// 直接进入本屏（未做选择）时退回模式选择；
// DLC 线路恒不设 mode（chooseCampaign 清空、commit 统一派生 free），必须放行，
// 否则 DLC 预览开局会在本屏挂载瞬间被弹回 POV 选择界面
onMounted(() => {
  if (!store.mode && store.campaignId === 'main') {
    store.backToMode();
  }
});
</script>

<style lang="scss" scoped>
.opening-text {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px 40px;
}

.text-card {
  width: 100%;
  max-width: 480px;
  padding: 26px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.text-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-primary-strong);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 4px;
}

.edit-toggle {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--c-primary);
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
}

.text-body {
  position: relative;
  padding-bottom: 4px;
}

.paragraph {
  font-size: 15px;
  line-height: 2;
  text-indent: 2em;
  margin-bottom: 10px;
  opacity: 0;
  animation: paragraph-in 0.8s ease forwards;
}

@keyframes paragraph-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.edit-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 200px;
  padding: 12px;
  border: 1px solid var(--c-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  background: var(--c-bg-input, rgba(255, 255, 255, 0.6));
  font-size: 14px;
  line-height: 1.8;
  font-family: inherit;
}

.edit-meta {
  display: flex;
  justify-content: flex-end;
}

.char-count {
  font-size: 12px;
  color: var(--c-text-dim, #888);

  &.over {
    color: #c0392b;
    font-weight: 700;
  }
}

.edit-warning {
  font-size: 12px;
  color: #b8860b;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
}

.edit-hint {
  font-size: 12px;
  color: var(--c-text-dim, #888);
  margin: 0;
}

.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .btn-ghost {
    flex: 1;
    min-width: 96px;
  }
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: var(--c-primary);
  vertical-align: text-bottom;
  animation: cursor-blink 1s step-end infinite;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.start-btn {
  align-self: center;
  min-width: 200px;
}
</style>
