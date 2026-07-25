<template>
  <div class="custom-form">
    <h2 class="screen-title">创建属于你的主角</h2>

    <div class="form-card card">
      <!-- AI 辅助设置（折叠面板，配置存 localStorage） -->
      <details class="ai-panel" :open="aiPanelOpen" @toggle="aiPanelOpen = ($event.target as HTMLDetailsElement).open">
        <summary><i class="fa-solid fa-wand-magic-sparkles"></i> AI 辅助设置</summary>
        <div class="ai-panel-body">
          <label class="field">
            <span class="label">Base URL</span>
            <input v-model.trim="apiConfig.base_url" type="text" placeholder="https://api.openai.com/v1" />
          </label>
          <label class="field">
            <span class="label">API Key</span>
            <input v-model.trim="apiConfig.api_key" type="password" placeholder="sk-..." />
          </label>
          <label class="field">
            <span class="label">Model</span>
            <input v-model.trim="apiConfig.model" type="text" placeholder="gpt-4o-mini" />
          </label>
          <button class="btn-ghost test-btn" :disabled="testing" @click="testConnection">
            <i class="fa-solid" :class="testing ? 'fa-spinner fa-spin' : 'fa-plug'"></i>
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
        </div>
      </details>

      <!-- 基础信息 -->
      <label class="field">
        <span class="label">姓名 <em class="required">*</em></span>
        <input v-model.trim="store.form.name" type="text" placeholder="主角的姓名" maxlength="20" />
      </label>

      <div class="field">
        <span class="label">性别</span>
        <div class="gender-group">
          <label v-for="option in GENDER_OPTIONS" :key="option" class="gender-option">
            <input v-model="store.form.gender" type="radio" name="gender" :value="option" />
            <span>{{ option }}</span>
          </label>
        </div>
      </div>

      <label class="field">
        <span class="label">所在班级</span>
        <select v-model="store.form.className">
          <option value="" disabled>请选择班级</option>
          <option v-for="option in CLASS_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <!-- 长文本字段：带 AI 辅助填写 -->
      <div v-for="field in AI_FIELDS" :key="field.key" class="field">
        <div class="label-row">
          <span class="label">{{ field.label }}</span>
          <button
            class="ai-fill-btn"
            :disabled="aiLoading[field.key]"
            :title="`让 AI 帮你撰写「${field.label}」`"
            @click="aiFill(field)"
          >
            <i class="fa-solid" :class="aiLoading[field.key] ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
            {{ aiLoading[field.key] ? '生成中…' : '✨ AI 帮我写' }}
          </button>
        </div>
        <textarea
          v-model="store.form[field.key]"
          :placeholder="field.placeholder"
          rows="3"
          maxlength="500"
        ></textarea>
      </div>

      <div class="actions">
        <button class="btn-ghost" @click="store.backToMode()"><i class="fa-solid fa-arrow-left"></i> 返回</button>
        <button class="btn-primary" @click="store.confirmCustom()">确认创建</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOpeningStore, type CustomForm } from './store';
import { showToast } from './toast';

const store = useOpeningStore();

const GENDER_OPTIONS = ['男', '女', '其他'] as const;

// 正式班级列表：与本作 AU 起点（2013 年·二年级）对齐
const CLASS_OPTIONS = ['二年F班', '二年J班（国际课程）', '一年级', '三年级', '其他'];

interface AiField {
  key: keyof Pick<CustomForm, 'identity' | 'past' | 'personality' | 'appearance'>;
  label: string;
  placeholder: string;
}

const AI_FIELDS: AiField[] = [
  { key: 'identity', label: '身份', placeholder: '如：二年J班转学生' },
  { key: 'past', label: '过往经历', placeholder: '主角来到总武高中之前的故事' },
  { key: 'personality', label: '性格', placeholder: '主角的性格与说话方式' },
  { key: 'appearance', label: '相貌', placeholder: '主角的外貌特征' },
];

// 供 AI 参考的全部字段（含基础信息）
const ALL_FIELDS: { key: keyof CustomForm; label: string }[] = [
  { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' },
  { key: 'className', label: '所在班级' },
  ...AI_FIELDS.map(({ key, label }) => ({ key, label })),
];

// AI 辅助设置：持久化到 localStorage
const apiConfig = useLocalStorage('counterfeit.opening.api', {
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  model: 'gpt-4o-mini',
});

const aiPanelOpen = ref(false);
const testing = ref(false);
const aiLoading = reactive<Record<string, boolean>>({});

function normalizedBase(): string {
  return apiConfig.value.base_url.replace(/\/+$/, '');
}

async function testConnection() {
  if (!apiConfig.value.api_key) {
    showToast('请先填写 API Key', 'error');
    return;
  }
  testing.value = true;
  try {
    const response = await fetch(`${normalizedBase()}/models`, {
      headers: { Authorization: `Bearer ${apiConfig.value.api_key}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    showToast('连接成功', 'success');
  } catch (error) {
    console.warn('[开场白] AI 连接测试失败', error);
    showToast(`连接失败：${error instanceof Error ? error.message : String(error)}`, 'error', 4000);
  } finally {
    testing.value = false;
  }
}

async function aiFill(field: AiField) {
  if (!apiConfig.value.api_key) {
    aiPanelOpen.value = true;
    showToast('请先在「AI 辅助设置」中填写 API Key', 'info');
    return;
  }
  aiLoading[field.key] = true;
  try {
    const others =
      ALL_FIELDS.filter(f => f.key !== field.key && store.form[f.key])
        .map(f => `${f.label}：${store.form[f.key]}`)
        .join('；') || '（暂无）';
    const prompt =
      `你在协助玩家为《我的青春恋爱物语果然有问题》同人 galgame 创建原创主角。` +
      `故事舞台是千叶市立总武高中，主角团为侍奉部成员（比企谷八幡、雪之下雪乃、由比滨结衣、转学生拉芙希妮·都柏林）。` +
      `请为玩家的原创角色撰写「${field.label}」，要求：简体中文、80-150 字、自然不做作、与原作氛围一致。` +
      `已填写的其他信息：${others}`;
    const response = await fetch(`${normalizedBase()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiConfig.value.api_key}`,
      },
      body: JSON.stringify({
        model: apiConfig.value.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('返回内容为空');
    }
    store.form[field.key] = text;
    showToast(`「${field.label}」已生成，可继续编辑`, 'success');
  } catch (error) {
    console.warn('[开场白] AI 生成失败', error);
    showToast(`生成失败：${error instanceof Error ? error.message : String(error)}`, 'error', 4000);
  } finally {
    aiLoading[field.key] = false;
  }
}
</script>

<style lang="scss" scoped>
.custom-form {
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
  margin-bottom: 24px;
}

.form-card {
  width: 100%;
  max-width: 480px;
  padding: 22px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-panel {
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface-muted);
  overflow: hidden;

  summary {
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 600;
    color: var(--c-primary-strong);
    cursor: pointer;
    list-style: none;
    user-select: none;

    i {
      margin-right: 6px;
    }
  }
}

.ai-panel-body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.test-btn {
  align-self: flex-start;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  color: var(--c-text-muted);
}

.required {
  color: var(--c-danger);
  font-style: normal;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

input[type='text'],
input[type='password'],
select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  background: var(--c-surface);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--c-primary);
  }
}

textarea {
  resize: vertical;
  line-height: 1.7;
}

.gender-group {
  display: flex;
  gap: 10px;
}

.gender-option {
  flex: 1;

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  span {
    display: block;
    text-align: center;
    padding: 9px 0;
    border: 1px solid var(--c-border);
    border-radius: 10px;
    font-size: 14px;
    color: var(--c-text-muted);
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      color 0.15s ease;
  }

  input:checked + span {
    border-color: var(--c-primary);
    background: var(--c-primary-soft);
    color: var(--c-primary-strong);
    font-weight: 600;
  }
}

.ai-fill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: var(--radius-button);
  border: 1px solid var(--c-accent-soft);
  background: var(--c-surface);
  color: var(--c-accent);
  font-size: 12px;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--c-accent-soft);
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.actions {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
