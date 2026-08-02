<template>
  <div class="app-screen">
    <AppHeader title="设置" />
    <div class="settings-scroll">
      <section class="card">
        <button class="setting-row" @click="store.openApp('wallpaper')">
          <i class="fa-solid fa-photo-film"></i>
          <span>壁纸</span>
          <i class="fa-solid fa-chevron-right row-arrow"></i>
        </button>
        <button class="setting-row" @click="resetLauncherPos">
          <i class="fa-solid fa-location-crosshairs"></i>
          <span>重置悬浮球位置</span>
          <em v-if="posReset" class="row-note">已重置</em>
        </button>
        <button class="setting-row" @click="reloadData">
          <i class="fa-solid fa-arrows-rotate"></i>
          <span>重新读取变量与世界书</span>
          <em v-if="reloaded" class="row-note">完成</em>
        </button>
      </section>

      <!-- AI 模型配置 -->
      <section class="card">
        <h3 class="card-title">AI 模型</h3>
        <div class="seg">
          <button
            v-for="opt in LLM_MODES"
            :key="opt.value"
            class="seg-item"
            :class="{ active: llmDraft.mode === opt.value }"
            @click="llmDraft.mode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <template v-if="llmDraft.mode === 'custom'">
          <label class="field">
            <span>API 地址</span>
            <input v-model.trim="llmDraft.apiurl" type="text" placeholder="https://api.example.com/v1" />
          </label>
          <label class="field">
            <span>API Key</span>
            <input v-model.trim="llmDraft.key" type="password" placeholder="只存在本机，不写聊天变量" />
          </label>
          <label class="field">
            <span>模型</span>
            <input v-model.trim="llmDraft.model" type="text" list="phone-model-list" placeholder="留空＝API 默认" />
            <datalist id="phone-model-list">
              <option v-for="m in modelOptions" :key="m" :value="m"></option>
            </datalist>
          </label>
          <button class="mini-btn" :disabled="modelLoading" @click="pullModels">
            <i class="fa-solid fa-cloud-arrow-down"></i>
            {{
              modelLoading ? '拉取中…' : modelOptions.length ? `已拉取 ${modelOptions.length} 个模型` : '拉取模型列表'
            }}
          </button>
        </template>

        <template v-else-if="llmDraft.mode === 'preset'">
          <label class="field">
            <span>代理预设</span>
            <select v-model="llmDraft.proxyPreset">
              <option value="">（选择一个酒馆代理预设）</option>
              <option v-for="p in proxyPresets" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <p v-if="!proxyPresets.length" class="field-hint">没读到代理预设（预览模式或酒馆未配置）</p>
          <label class="field">
            <span>模型</span>
            <input v-model.trim="llmDraft.model" type="text" placeholder="留空＝预设默认" />
          </label>
        </template>

        <template v-if="llmDraft.mode !== 'default'">
          <div class="field-pair">
            <label class="field">
              <span>温度</span>
              <input v-model="temperatureText" type="number" step="0.1" min="0" max="2" placeholder="跟随预设" />
            </label>
            <label class="field">
              <span>最大 tokens</span>
              <input v-model="maxTokensText" type="number" min="1" placeholder="跟随预设" />
            </label>
          </div>
        </template>

        <div class="llm-status">
          <i class="fa-solid fa-circle-info"></i>
          <span>{{ llmStatus }}</span>
          <button v-if="llmDraft.mode !== 'default'" class="link-btn" @click="resetLlm">恢复默认</button>
        </div>
        <p class="field-hint">
          配置只保存在本机（localStorage），用于消息回复、NPC 来信与论坛生成；Key 不会写入聊天变量。
        </p>
      </section>

      <!-- 主动来信与论坛共用的内容导演提示词 -->
      <section class="card">
        <h3 class="card-title">内容导演</h3>
        <label class="field field-block">
          <span>自定义提示词</span>
          <textarea
            v-model="contentPromptDraft"
            rows="5"
            :maxlength="CONTENT_PROMPT_MAX_LENGTH"
            placeholder="例：来信多聊考试周的日常；论坛增加求助帖和夸张标题，减少具名角色传闻"
          ></textarea>
        </label>
        <div class="prompt-meta">
          <span>{{ contentPromptDraft.length }}/{{ CONTENT_PROMPT_MAX_LENGTH }}</span>
          <button v-if="contentPromptDraft" class="link-btn" @click="resetContentPrompt">清空</button>
        </div>
        <p class="field-hint">
          同时作用于 NPC
          主动来信、论坛发帖和回复链；不影响玩家主动私聊。角色资料、已发生事实、知情范围、论坛独立性和禁止剧透规则始终优先。
        </p>
      </section>

      <!-- NPC 互动设置 -->
      <section class="card">
        <h3 class="card-title">主线同步</h3>
        <div class="seg">
          <button
            v-for="option in SYNC_MODES"
            :key="option.value"
            class="seg-item"
            :class="{ active: npcDraft.mainlineSyncMode === option.value }"
            @click="npcDraft.mainlineSyncMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <p class="field-hint">
          自动：每次主线回复后只提取明确发生的联系方式、群聊和约定；手动：加入待解析队列；关闭：完全不解析。手机聊天不会自行触发主线生成。
        </p>
        <div v-if="npcDraft.mainlineSyncMode === 'manual'" class="manual-sync">
          <span>待解析 {{ store.phone.context.manual_queue.length }} 条</span>
          <button class="mini-btn" :disabled="manualParsing" @click="parseLatest">
            {{ manualParsing ? '解析中…' : '解析最新主线回复' }}
          </button>
        </div>
        <p v-if="manualParseHint" class="field-hint">{{ manualParseHint }}</p>
      </section>

      <section class="card">
        <h3 class="card-title">NPC 互动</h3>

        <div class="setting-row toggle-row">
          <i class="fa-solid fa-envelope-open-text"></i>
          <span>NPC 主动来信</span>
          <button
            class="switch"
            :class="{ on: npcDraft.proactiveEnabled }"
            @click="npcDraft.proactiveEnabled = !npcDraft.proactiveEnabled"
          >
            <i></i>
          </button>
        </div>

        <template v-if="npcDraft.proactiveEnabled">
          <div class="setting-row range-row">
            <span>来信概率</span>
            <input v-model.number="npcDraft.proactiveChance" type="range" min="0" max="100" step="5" />
            <b>{{ npcDraft.proactiveChance }}%</b>
          </div>
          <label class="field">
            <span>冷却（分钟）</span>
            <input v-model.number="npcDraft.cooldownMinutes" type="number" min="1" max="60" />
          </label>
        </template>

        <label class="field">
          <span>回复引用历史条数</span>
          <input v-model.number="npcDraft.historyLength" type="number" min="2" max="20" />
        </label>

        <button class="mini-btn" @click="resetNpc"><i class="fa-solid fa-rotate-left"></i> 恢复互动默认设置</button>
        <p class="field-hint">添加好友、删除好友、创建群聊和聊天次数都不会机械修改关系变量。</p>
      </section>

      <section class="card">
        <h3 class="card-title">论坛自动刷新</h3>
        <div class="setting-row toggle-row">
          <i class="fa-solid fa-comments"></i>
          <span>主线回复后自动生成新帖</span>
          <button
            class="switch"
            :class="{ on: npcDraft.forumAutoRefreshEnabled }"
            @click="npcDraft.forumAutoRefreshEnabled = !npcDraft.forumAutoRefreshEnabled"
          >
            <i></i>
          </button>
        </div>
        <template v-if="npcDraft.forumAutoRefreshEnabled">
          <div class="setting-row range-row">
            <span>触发概率</span>
            <input v-model.number="npcDraft.forumAutoRefreshChance" type="range" min="0" max="100" step="5" />
            <b>{{ npcDraft.forumAutoRefreshChance }}%</b>
          </div>
          <label class="field">
            <span>冷却（分钟）</span>
            <input v-model.number="npcDraft.forumAutoRefreshCooldownMinutes" type="number" min="1" max="1440" />
          </label>
        </template>
        <p class="field-hint">
          每次主线 AI 回复后按概率触发；冷却避免连续刷屏。也可在"论坛"里手动点"刷新论坛"立即生成。
        </p>
      </section>

      <section class="card">
        <h3 class="card-title">关于</h3>
        <div class="row"><span>版本</span><b>v5 · Counterfeit</b></div>
        <div class="row"><span>变量</span><b>stat_data.phone.*</b></div>
        <div class="row"><span>数据层</span><b>contacts / threads / messages</b></div>
        <div class="row"><span>长期记忆</span><b>摘要 + 事实 + 待办</b></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import {
  CONTENT_PROMPT_MAX_LENGTH,
  fetchModelList,
  listProxyPresets,
  llmStatusText,
  type LlmConfig,
  type NpcSettings,
} from './settings';
import { usePhoneStore } from './store';

const store = usePhoneStore();
const posReset = ref(false);
const reloaded = ref(false);

/* —— LLM 模型配置 —— */

const LLM_MODES: { value: LlmConfig['mode']; label: string }[] = [
  { value: 'default', label: '跟随酒馆' },
  { value: 'custom', label: '自定义 API' },
  { value: 'preset', label: '代理预设' },
];
const SYNC_MODES: { value: NpcSettings['mainlineSyncMode']; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'manual', label: '手动' },
  { value: 'off', label: '关闭' },
];

const llmDraft = reactive<LlmConfig>({ ...store.llm });
const npcDraft = reactive<NpcSettings>({ ...store.npc });
const contentPromptDraft = ref(store.contentPrompt);
const modelOptions = ref<string[]>([]);
const modelLoading = ref(false);
const proxyPresets = ref<string[]>([]);
const manualParsing = ref(false);
const manualParseHint = ref('');

const llmStatus = computed(() => llmStatusText(llmDraft));

// 温度/tokens：输入框是字符串，空串＝跟随预设
const temperatureText = computed({
  get: () => (llmDraft.temperature == null ? '' : String(llmDraft.temperature)),
  set: v => {
    const n = parseFloat(v);
    llmDraft.temperature = v === '' || Number.isNaN(n) ? null : Math.max(0, Math.min(2, n));
  },
});
const maxTokensText = computed({
  get: () => (llmDraft.maxTokens == null ? '' : String(llmDraft.maxTokens)),
  set: v => {
    const n = parseInt(v, 10);
    llmDraft.maxTokens = v === '' || Number.isNaN(n) ? null : Math.max(1, n);
  },
});

watch(llmDraft, () => store.updateLlmConfig({ ...llmDraft }), { deep: true });
watch(npcDraft, () => store.updateNpcSettings({ ...npcDraft }), { deep: true });
watch(contentPromptDraft, value => store.updateContentPrompt(value));
// 重置后回同步草稿
watch(
  () => store.llm,
  v => Object.assign(llmDraft, v),
);
watch(
  () => store.npc,
  v => Object.assign(npcDraft, v),
);
watch(
  () => store.contentPrompt,
  value => {
    if (value !== contentPromptDraft.value) {
      contentPromptDraft.value = value;
    }
  },
);

async function pullModels() {
  modelLoading.value = true;
  modelOptions.value = await fetchModelList(llmDraft);
  modelLoading.value = false;
}

function resetLlm() {
  store.resetLlmConfig();
  modelOptions.value = [];
}

function resetNpc() {
  store.resetNpcSettings();
}

function resetContentPrompt() {
  store.resetContentPrompt();
}

async function parseLatest() {
  if (manualParsing.value) return;
  manualParsing.value = true;
  manualParseHint.value = '';
  try {
    const outcome = await store.parseLatestMainline();
    if (outcome.status === 'error') {
      manualParseHint.value = `解析失败：${outcome.error || '请检查 LLM 配置'}`;
    } else if (outcome.status === 'no-message') {
      manualParseHint.value = '没有可解析的主线回复';
    } else if (outcome.addedContacts.length) {
      manualParseHint.value = `已添加 ${outcome.addedContacts.length} 位联系人`;
    } else {
      const extra =
        outcome.addedGroups + outcome.addedFacts + outcome.addedAppointments;
      manualParseHint.value = extra ? `已记录 ${extra} 项手机事实` : '本次没有可提取的手机事实';
    }
  } finally {
    manualParsing.value = false;
  }
}

onMounted(() => {
  proxyPresets.value = listProxyPresets();
});

/* —— 原有操作 —— */

function resetLauncherPos() {
  try {
    window.parent?.localStorage?.removeItem('counterfeit.phone.launcher.pos');
  } catch {
    /* 忽略 */
  }
  try {
    localStorage.removeItem('counterfeit.phone.launcher.pos');
  } catch {
    /* 忽略 */
  }
  posReset.value = true;
  window.setTimeout(() => (posReset.value = false), 1600);
}

async function reloadData() {
  store.refresh();
  await store.refreshPersonas();
  reloaded.value = true;
  window.setTimeout(() => (reloaded.value = false), 1600);
}
</script>

<style lang="scss" scoped>
.app-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--c-phone-screen);
  min-height: 0;
}

.settings-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 6px 16px 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 13px;
  color: var(--c-ios-gray);
  margin: 10px 0 6px;
  letter-spacing: 2px;
}

.setting-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
  font-size: 14px;
  text-align: left;

  & + .setting-row {
    border-top: 1px solid var(--c-separator);
  }

  > i:first-child {
    width: 26px;
    color: var(--c-ios-blue);
    font-size: 15px;
  }

  span {
    flex: 1;
  }
}

.row-arrow {
  color: #c7c7cc;
  font-size: 12px;
}

.row-note {
  font-size: 12px;
  color: var(--c-success);
  font-style: normal;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;

  span {
    color: var(--c-ios-gray);
  }
}

/* —— 分段选择 —— */

.seg {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin: 6px 0 10px;
  border-radius: 10px;
  background: var(--c-phone-screen);
}

.seg-item {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  font-size: 13px;
  color: var(--c-ios-gray);
  transition: background 0.15s ease;

  &.active {
    background: #fff;
    color: var(--c-text);
    font-weight: 700;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  }
}

/* —— 表单 —— */

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 13px;

  span {
    flex: none;
    width: 92px;
    color: var(--c-ios-gray);
  }

  input,
  select,
  textarea {
    flex: 1;
    min-width: 0;
    padding: 7px 10px;
    border: 1px solid var(--c-separator);
    border-radius: 9px;
    font-size: 13px;
    font-family: inherit;
    color: var(--c-text);
    background: #fff;
    outline: none;

    &:focus {
      border-color: var(--c-ios-blue);
    }
  }

  &.field-block {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;

    span {
      width: auto;
    }

    textarea {
      resize: vertical;
      line-height: 1.6;
    }
  }
}

.field-pair {
  display: flex;
  gap: 12px;

  .field {
    flex: 1;

    span {
      width: auto;
      white-space: nowrap;
    }
  }
}

.field-hint {
  padding: 6px 0 2px;
  font-size: 11px;
  color: var(--c-ios-gray);
  line-height: 1.6;
}

.prompt-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 22px;
  font-size: 11px;
  color: var(--c-ios-gray);
}

.manual-sync {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 6px;
  color: var(--c-ios-gray);
  font-size: 11px;

  .mini-btn {
    margin: 0;
  }
}

.mini-btn {
  margin: 6px 0 2px;
  padding: 7px 16px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;

  &:disabled {
    opacity: 0.5;
  }

  i {
    margin-right: 5px;
  }
}

.llm-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--c-phone-screen);
  font-size: 12px;
  color: var(--c-ios-gray);

  i {
    color: var(--c-ios-blue);
  }

  span {
    flex: 1;
  }
}

.link-btn {
  font-size: 12px;
  color: var(--c-ios-blue);
}

/* —— 开关 —— */

.toggle-row {
  span {
    flex: 1;
  }
}

.switch {
  flex: none;
  width: 46px;
  height: 27px;
  border-radius: 999px;
  background: #d8d8de;
  padding: 2px;
  transition: background 0.2s ease;

  i {
    display: block;
    width: 23px;
    height: 23px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }

  &.on {
    background: var(--c-ios-green);

    i {
      transform: translateX(19px);
    }
  }
}

.range-row {
  gap: 10px;

  span {
    flex: none;
    color: var(--c-ios-gray);
    font-size: 13px;
  }

  input[type='range'] {
    flex: 1;
    accent-color: var(--c-ios-blue);
  }

  b {
    flex: none;
    width: 42px;
    text-align: right;
    font-size: 13px;
  }
}
</style>
