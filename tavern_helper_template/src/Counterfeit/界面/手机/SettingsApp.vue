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
        <h3 class="card-title">奉仕部委托</h3>
        <div class="setting-row toggle-row">
          <i class="fa-solid fa-clipboard-list"></i>
          <span>主线回复后自动生成委托</span>
          <button
            class="switch"
            :class="{ on: npcDraft.requestAutoRefreshEnabled }"
            @click="npcDraft.requestAutoRefreshEnabled = !npcDraft.requestAutoRefreshEnabled"
          >
            <i></i>
          </button>
        </div>
        <template v-if="npcDraft.requestAutoRefreshEnabled">
          <div class="setting-row range-row">
            <span>触发概率</span>
            <input v-model.number="npcDraft.requestAutoRefreshChance" type="range" min="0" max="100" step="5" />
            <b>{{ npcDraft.requestAutoRefreshChance }}%</b>
          </div>
          <label class="field">
            <span>冷却（分钟）</span>
            <input v-model.number="npcDraft.requestAutoRefreshCooldownMinutes" type="number" min="1" max="1440" />
          </label>
        </template>
        <p class="field-hint">
          委托面向开放世界（free）模式：结合日期、在场人物、世界书 NPC 与数据库记录生成"事件方向提示"。也可在"委托"里手动刷新。POV 剧本模式下不生成。
        </p>
      </section>

      <section class="card">
        <h3 class="card-title">数据库联动</h3>
        <div class="setting-row toggle-row">
          <i class="fa-solid fa-database"></i>
          <span>数据库联动总开关</span>
          <button
            class="switch"
            :class="{ on: npcDraft.shujukuEnabled }"
            @click="npcDraft.shujukuEnabled = !npcDraft.shujukuEnabled"
          >
            <i></i>
          </button>
        </div>
        <template v-if="npcDraft.shujukuEnabled">
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-book-open-reader"></i>
            <span>读取角色表 / 日记</span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbReadCharEnabled }"
              @click="npcDraft.dbReadCharEnabled = !npcDraft.dbReadCharEnabled"
            >
              <i></i>
            </button>
          </div>
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-scroll"></i>
            <span>读取剧情纪要<span v-if="npcDraft.dbReadSummaryEnabled" class="toggle-badge">默认开启</span></span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbReadSummaryEnabled }"
              @click="npcDraft.dbReadSummaryEnabled = !npcDraft.dbReadSummaryEnabled"
            >
              <i></i>
            </button>
          </div>
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-film"></i>
            <span>读取导演大纲<span v-if="npcDraft.dbReadDirectorEnabled" class="toggle-badge">已开启</span></span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbReadDirectorEnabled }"
              @click="npcDraft.dbReadDirectorEnabled = !npcDraft.dbReadDirectorEnabled"
            >
              <i></i>
            </button>
          </div>
          <p class="field-hint spoiler-hint">
            导演大纲是<b>导演层资料，不是角色记忆</b>：仅供手机互动不与未来规划冲突；NPC
            不得声称知道、看过或复述大纲；未发生内容不会作为事实、消息或秘密提前泄露。默认关闭以防剧透。
          </p>
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-note-sticky"></i>
            <span>约定同步到备忘录表</span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbWriteMemoEnabled }"
              @click="npcDraft.dbWriteMemoEnabled = !npcDraft.dbWriteMemoEnabled"
            >
              <i></i>
            </button>
          </div>
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-box-archive"></i>
            <span>重要会话归档纪要表</span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbWriteSummaryEnabled }"
              @click="npcDraft.dbWriteSummaryEnabled = !npcDraft.dbWriteSummaryEnabled"
            >
              <i></i>
            </button>
          </div>
          <div class="setting-row toggle-row">
            <i class="fa-solid fa-heart"></i>
            <span>恋爱向会话补写恋爱日记</span>
            <button
              class="switch"
              :class="{ on: npcDraft.dbWriteDiaryEnabled }"
              @click="npcDraft.dbWriteDiaryEnabled = !npcDraft.dbWriteDiaryEnabled"
            >
              <i></i>
            </button>
          </div>
          <div class="db-status" v-if="shujukuOk">
            <div class="db-status-head">
              <i class="fa-solid fa-circle-check"></i>
              <span>数据库 API 已就绪</span>
              <button class="link-btn" @click="refreshDbStatus">刷新</button>
            </div>
            <div v-for="row in dbStatusRows" :key="row.label" class="db-status-row">
              <span>{{ row.label }}</span>
              <b v-if="row.name">{{ row.name }}（{{ row.rowCount }} 行）</b>
              <em v-else>未命中（候选：{{ row.candidates }}）</em>
            </div>
          </div>
          <p v-else class="field-hint">当前状态：未检测到数据库 API（自动跳过，不影响手机功能）。</p>
        </template>
        <p class="field-hint">
          只读联动：通过 shujuku（SP·数据库）读取当前存档表格（角色/纪要/导演规划）作为回复参考，
          已发生纪要仍是"角色只知道自己亲历/被告知/合理可知的部分"。
          写入联动：归档以摘要推进为节奏，AM 码自动递增，来源标记【手机】写进纪要正文真实存在的列；
          写进纪要表的内容会经数据库自己的世界书注入回到主线。
        </p>
      </section>

      <section class="card">
        <h3 class="card-title">数据</h3>
        <div class="row"><span>会话数</span><b>{{ stats.threadCount }}</b></div>
        <div class="row"><span>消息数</span><b>{{ stats.messageCount }}</b></div>
        <div class="row"><span>存档大小</span><b>{{ statsBytes }}</b></div>
        <div class="row">
          <span>自动保存</span>
          <b :class="saveTone">{{ saveText }}</b>
        </div>
        <button class="mini-btn" @click="saveNow"><i class="fa-solid fa-floppy-disk"></i> 立即保存</button>
        <div class="data-actions">
          <button class="data-btn" @click="exportPortable">
            <i class="fa-solid fa-box-archive"></i> 导出完整游戏存档（.counterfeit-save.json）
          </button>
          <button class="data-btn" @click="exportAll">
            <i class="fa-solid fa-file-arrow-down"></i> 导出手机数据备份（JSON）
          </button>
          <label class="data-btn file-btn">
            <i class="fa-solid fa-file-arrow-up"></i> 导入备份（JSON）
            <input type="file" accept=".json,application/json" hidden @change="onPickImportFile" />
          </label>
        </div>
        <p v-if="importMessage" class="field-hint" :class="importTone">{{ importMessage }}</p>
        <template v-if="pendingBackup">
          <p class="field-hint import-note">
            已自动导出当前数据为备份（导入前备份）。校验通过：{{ pendingSummary }}。选择导入方式（ID
            冲突不会静默覆盖）：
          </p>
          <div class="import-actions">
            <button class="data-btn" @click="doImport('merge')"><i class="fa-solid fa-code-merge"></i> 合并导入</button>
            <button class="data-btn danger" @click="doImport('overwrite')">
              <i class="fa-solid fa-rectangle-xmark"></i> 覆盖导入
            </button>
          </div>
        </template>
        <p class="field-hint">
          清空会话只删除消息：联系人与会话壳保留、不回滚已发生的主线、不删除已写入数据库的纪要/日记/备忘。
        </p>
      </section>

      <section class="card">
        <h3 class="card-title">关于</h3>
        <div class="row"><span>版本</span><b>v5.1 · Counterfeit</b></div>
        <div class="row"><span>变量</span><b>stat_data.phone.*</b></div>
        <div class="row"><span>数据层</span><b>contacts / threads / messages</b></div>
        <div class="row"><span>长期记忆</span><b>摘要 + 事实 + 待办</b></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import { buildPortableSave, sanitizeResumeTail } from '../../存档/portableSave';
import {
  CONTENT_PROMPT_MAX_LENGTH,
  fetchModelList,
  listProxyPresets,
  llmStatusText,
  type LlmConfig,
  type NpcSettings,
} from './settings';
import { invalidateSheets, readDbStatus, type DbStatusRow } from './shujuku';
import { usePhoneStore, type ImportReport } from './store';

const store = usePhoneStore();
const posReset = ref(false);
const reloaded = ref(false);
const shujukuOk = ref(false);
const dbStatusRows = ref<DbStatusRow[]>([]);

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

/* —— 数据统计 / 自动保存 / 导入导出 —— */

const stats = computed(() => store.dataStats());
const statsBytes = computed(() => {
  const bytes = stats.value.bytes;
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${bytes} B`;
});
const saveText = computed(() => {
  if (store.saveState === 'saving') return '保存中…';
  if (store.saveState === 'error') return `保存失败：${store.saveError || '未知错误'}`;
  if (store.saveState === 'saved' && store.lastSavedAt) {
    return `已保存 · ${new Date(store.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return store.lastSavedAt ? '已自动保存' : '尚无保存记录';
});
const saveTone = computed(() => (store.saveState === 'error' ? 'save-error' : ''));

const importMessage = ref('');
const importTone = ref('');
const pendingBackup = ref<{
  name: string;
  summary: string;
  merge: () => Promise<void>;
  overwrite: () => Promise<void>;
} | null>(null);

async function saveNow() {
  await store.saveNow();
}

function exportAll() {
  store.exportAllPhoneJson();
  importMessage.value = '';
}

async function exportPortable() {
  try {
    const lastId = typeof getLastMessageId === 'function' ? getLastMessageId() : 0;
    const stat = (getVariables({ type: 'message', message_id: lastId }) || getVariables({ type: 'chat' }) || {}).stat_data;
    if (!stat) throw new Error('当前聊天没有可导出的 stat_data');
    const messages = typeof getChatMessages === 'function' ? getChatMessages(`0-${lastId}`) : [];
    const tail = sanitizeResumeTail((Array.isArray(messages) ? messages : []).slice(-8).flatMap((m:any) => {
      const role = m.role === 'user' || m.is_user === true ? 'user' : m.role === 'assistant' || m.is_user === false ? 'assistant' : null;
      return role ? [{ role, text: String(m.message ?? m.mes ?? '') }] : [];
    }));
    const save = await buildPortableSave(stat, tail, Array.isArray(messages) ? messages.length : 0);
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `Counterfeit-${save.campaign_id}-${new Date().toISOString().slice(0,10)}.counterfeit-save.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('[手机] 完整游戏存档导出失败', error);
  }
}

function onPickImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  void handleImportFile(file);
}

async function handleImportFile(file: File) {
  importMessage.value = '';
  importTone.value = '';
  pendingBackup.value = null;
  try {
    const text = await file.text();
    const parsed = store.parsePhoneBackup(text);
    if (!parsed.ok) {
      importMessage.value = `导入校验失败：${parsed.errors.join('；')}`;
      importTone.value = 'error';
      return;
    }
    const backup = parsed.backup!;
    const names = Object.keys(backup.threads ?? {}).length;
    const count = Object.values((backup.messages ?? {}) as Record<string, unknown[]>).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0,
    );
    const factCount = Array.isArray(backup.facts) ? backup.facts.length : 0;
    const apptCount = Array.isArray(backup.appointments) ? backup.appointments.length : 0;
    // 导入前自动导出现有备份（下载当前数据）
    store.backupBeforeImport();
    pendingBackup.value = {
      name: file.name,
      summary: `${names} 个会话 / ${count} 条消息 / ${factCount} 条事实 / ${apptCount} 项约定`,
      merge: async () => {
        await store.importPhoneBackup(backup, 'merge');
      },
      overwrite: async () => {
        await store.importPhoneBackup(backup, 'overwrite');
      },
    };
  } catch (error) {
    importMessage.value = `读取文件失败：${error instanceof Error ? error.message : String(error)}`;
    importTone.value = 'error';
  }
}

async function doImport(mode: 'merge' | 'overwrite') {
  const pending = pendingBackup.value;
  if (!pending) return;
  try {
    const report: ImportReport = mode === 'merge' ? await pending.merge() : await pending.overwrite();
    const added =
      report.contactsAdded +
      report.threadsAdded +
      report.messagesAdded +
      report.factsAdded +
      report.appointmentsAdded +
      report.requestsAdded;
    const skipped =
      report.contactsSkipped +
      report.threadsSkipped +
      report.messagesSkipped +
      report.factsSkipped +
      report.appointmentsSkipped +
      report.requestsSkipped;
    importMessage.value = `${mode === 'merge' ? '合并' : '覆盖'}完成：新增 ${added} 项；冲突/跳过 ${skipped} 项${skipped ? '（未静默覆盖）' : ''}`;
    if (report.conflicts.length) {
      importMessage.value += `；冲突明细：${report.conflicts.slice(0, 3).join('；')}${report.conflicts.length > 3 ? '…' : ''}`;
    }
    importTone.value = skipped ? 'warn' : 'ok';
    pendingBackup.value = null;
    refreshDbStatus();
  } catch (error) {
    importMessage.value = `导入失败：${error instanceof Error ? error.message : String(error)}`;
    importTone.value = 'error';
  }
}

/* —— 数据库状态 —— */

function refreshDbStatus() {
  invalidateSheets();
  const status = readDbStatus();
  shujukuOk.value = status.available;
  dbStatusRows.value = status.sheets;
}

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
// 数据库总开关变化时刷新命中状态
watch(
  () => npcDraft.shujukuEnabled,
  enabled => {
    if (enabled) refreshDbStatus();
  },
);
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
  refreshDbStatus();
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
  flex-wrap: wrap;
  gap: 12px;

  .field {
    flex: 1;
    min-width: 160px;

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

/* —— 数据库状态 / 数据统计 / 导入导出 —— */

.toggle-badge {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(40, 199, 111, 0.12);
  color: var(--c-success);
  font-size: 9px;
}

.spoiler-hint {
  border-left: 2px solid rgba(255, 149, 0, 0.5);
  padding-left: 8px;
  color: #8a6d1a;
}

.db-status {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--c-phone-screen);
  font-size: 11px;
  line-height: 1.9;
}

.db-status-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--c-success);
  font-weight: 700;

  .link-btn {
    margin-left: auto;
  }
}

.db-status-row {
  display: flex;
  align-items: baseline;
  gap: 8px;

  span {
    flex: none;
    width: 72px;
    color: var(--c-ios-gray);
  }

  b {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    flex: 1;
    color: #b26a00;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.save-error {
  color: var(--c-danger);
}

.data-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.data-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(10, 132, 255, 0.1);
  color: var(--c-ios-blue);
  font-size: 12px;

  &.danger {
    background: rgba(255, 59, 48, 0.1);
    color: var(--c-danger);
  }

  i {
    font-size: 12px;
  }
}

.file-btn {
  cursor: pointer;
}

.import-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 6px;
}

.import-note {
  color: #8a6d1a;
}

.field-hint.error {
  color: var(--c-danger);
}

.field-hint.ok {
  color: var(--c-success);
}

.field-hint.warn {
  color: #b26a00;
}
</style>
