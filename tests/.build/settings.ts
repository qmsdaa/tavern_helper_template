// 手机助手 · 本地设置（LLM 模型配置 + NPC 互动设置 + 内容导演提示词）
// 持久化只用 localStorage、不写 MVU 聊天变量：
//   ① API key 属于敏感信息，写进 stat_data 会随聊天记录导出泄露；
//   ② 设置属于设备偏好（同悬浮球位置），换剧情档不该跟着走。
import { actNameOf, cnDate, loadSceneEntries } from './vars.ts';

/* —— LLM 模型配置 —— */

export interface LlmConfig {
  /** default＝跟随酒馆当前 API · custom＝自定义 OpenAI 兼容 API · preset＝酒馆代理预设 */
  mode: 'default' | 'custom' | 'preset';
  apiurl: string;
  key: string;
  model: string;
  proxyPreset: string;
  /** null＝跟随预设 */
  temperature: number | null;
  /** null＝跟随预设 */
  maxTokens: number | null;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  mode: 'default',
  apiurl: '',
  key: '',
  model: '',
  proxyPreset: '',
  temperature: null,
  maxTokens: null,
};

/* —— NPC 互动设置 —— */

export interface NpcSettings {
  /** NPC 主动来信开关 */
  proactiveEnabled: boolean;
  /** 来信触发概率（0-100，主聊天每次新 AI 消息时掷一次） */
  proactiveChance: number;
  /** 来信冷却（分钟） */
  cooldownMinutes: number;
  /** 回复引用的历史消息条数 */
  historyLength: number;
  /** 主线手机事实解析：auto 自动、manual 手动确认、off 关闭 */
  mainlineSyncMode: 'auto' | 'manual' | 'off';
  /** 论坛自动刷新开关（每次主线 AI 回复后按概率触发） */
  forumAutoRefreshEnabled: boolean;
  /** 论坛自动刷新触发概率（0-100） */
  forumAutoRefreshChance: number;
  /** 论坛自动刷新冷却（分钟） */
  forumAutoRefreshCooldownMinutes: number;
  /** 奉仕部委托自动刷新开关（free/custom 模式 · 主线回复后按概率触发） */
  requestAutoRefreshEnabled: boolean;
  /** 委托自动刷新触发概率（0-100） */
  requestAutoRefreshChance: number;
  /** 委托自动刷新冷却（分钟） */
  requestAutoRefreshCooldownMinutes: number;
  /** 数据库（shujuku）只读联动：委托生成时读取当前全局快照表格取材；未安装时自动跳过 */
  shujukuEnabled: boolean;
  /** 读取·角色表/恋爱日记：私聊/群聊回复时注入对方的角色表行与其近期日记 */
  dbReadCharEnabled: boolean;
  /** 读取·剧情纪要：回复时注入最近剧情纪要（已发生事实参考，默认开启） */
  dbReadSummaryEnabled: boolean;
  /** 读取·导演大纲：回复时注入导演规划（导演层资料不是角色记忆，默认关闭+防剧透） */
  dbReadDirectorEnabled: boolean;
  /** 写入·约定同步：手机里的约定写入备忘录表，状态变化同步更新 */
  dbWriteMemoEnabled: boolean;
  /** 写入·纪要归档：重要手机会话经 LLM 判断后写入纪要表（AM 码自动递增） */
  dbWriteSummaryEnabled: boolean;
  /** 写入·恋爱日记：恋爱向会话在纪要归档后补写第一人称日记（依赖纪要归档开启） */
  dbWriteDiaryEnabled: boolean;
}

export const DEFAULT_NPC_SETTINGS: NpcSettings = {
  proactiveEnabled: true,
  proactiveChance: 35,
  cooldownMinutes: 3,
  historyLength: 10,
  mainlineSyncMode: 'auto',
  forumAutoRefreshEnabled: false,
  forumAutoRefreshChance: 20,
  forumAutoRefreshCooldownMinutes: 30,
  requestAutoRefreshEnabled: false,
  requestAutoRefreshChance: 30,
  requestAutoRefreshCooldownMinutes: 60,
  shujukuEnabled: true,
  dbReadCharEnabled: true,
  dbReadSummaryEnabled: true,
  dbReadDirectorEnabled: false,
  dbWriteMemoEnabled: true,
  dbWriteSummaryEnabled: true,
  dbWriteDiaryEnabled: true,
};

/* —— 读写 —— */

const LLM_LS_KEY = 'counterfeit.phone.llm';
const NPC_LS_KEY = 'counterfeit.phone.npc';
const CONTENT_PROMPT_LS_KEY = 'counterfeit.phone.content-prompt';
export const CONTENT_PROMPT_MAX_LENGTH = 2000;

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return { ...fallback, ...(JSON.parse(raw) as T) };
    }
  } catch {
    /* 落到默认 */
  }
  return { ...fallback };
}

function writeLs(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 忽略 */
  }
}

export function loadLlmConfig(): LlmConfig {
  const cfg = readLs(LLM_LS_KEY, DEFAULT_LLM_CONFIG);
  if (!['default', 'custom', 'preset'].includes(cfg.mode)) {
    cfg.mode = 'default';
  }
  return cfg;
}

export function saveLlmConfig(cfg: LlmConfig) {
  writeLs(LLM_LS_KEY, cfg);
}

export function loadNpcSettings(): NpcSettings {
  const s = readLs(NPC_LS_KEY, DEFAULT_NPC_SETTINGS);
  s.proactiveChance = clamp(Math.round(s.proactiveChance), 0, 100);
  s.cooldownMinutes = clamp(Math.round(s.cooldownMinutes), 1, 60);
  s.historyLength = clamp(Math.round(s.historyLength), 2, 20);
  if (!['auto', 'manual', 'off'].includes(s.mainlineSyncMode)) {
    s.mainlineSyncMode = 'auto';
  }
  s.forumAutoRefreshEnabled = s.forumAutoRefreshEnabled === true;
  s.forumAutoRefreshChance = clamp(Math.round(s.forumAutoRefreshChance), 0, 100);
  s.forumAutoRefreshCooldownMinutes = clamp(Math.round(s.forumAutoRefreshCooldownMinutes), 1, 1440);
  s.requestAutoRefreshEnabled = s.requestAutoRefreshEnabled === true;
  s.requestAutoRefreshChance = clamp(Math.round(s.requestAutoRefreshChance ?? 30), 0, 100);
  s.requestAutoRefreshCooldownMinutes = clamp(Math.round(s.requestAutoRefreshCooldownMinutes ?? 60), 1, 1440);
  s.shujukuEnabled = s.shujukuEnabled !== false;
  // v5.1 起把「读取增强」拆成三个独立开关；旧版 dbReadEnrichEnabled=false 迁移为三者全关
  const legacyRead = s as NpcSettings & { dbReadEnrichEnabled?: boolean };
  if (legacyRead.dbReadEnrichEnabled === false) {
    s.dbReadCharEnabled = false;
    s.dbReadSummaryEnabled = false;
    s.dbReadDirectorEnabled = false;
  }
  s.dbReadCharEnabled = s.dbReadCharEnabled !== false;
  s.dbReadSummaryEnabled = s.dbReadSummaryEnabled !== false;
  s.dbReadDirectorEnabled = s.dbReadDirectorEnabled === true;
  delete legacyRead.dbReadEnrichEnabled;
  s.dbWriteMemoEnabled = s.dbWriteMemoEnabled !== false;
  s.dbWriteSummaryEnabled = s.dbWriteSummaryEnabled !== false;
  s.dbWriteDiaryEnabled = s.dbWriteDiaryEnabled !== false;
  // v4 以前的 extraPrompt 已迁移为独立内容导演提示词，不再混入私聊回复。
  const legacy = s as NpcSettings & { extraPrompt?: string; affectionGate?: number; affectionGain?: boolean };
  delete legacy.extraPrompt;
  delete legacy.affectionGate;
  delete legacy.affectionGain;
  return s;
}

export function saveNpcSettings(s: NpcSettings) {
  writeLs(NPC_LS_KEY, s);
}

/** 内容导演提示词：设备级设置，只作用于主动来信与论坛生成。 */
export function loadContentPrompt(): string {
  try {
    const raw = localStorage.getItem(CONTENT_PROMPT_LS_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      return normalizeContentPrompt(typeof parsed === 'string' ? parsed : '');
    }
  } catch {
    /* 继续尝试旧设置迁移 */
  }

  // 兼容旧版 NPC 设置：首次读取时把 extraPrompt 搬到独立存储键。
  try {
    const legacyRaw = localStorage.getItem(NPC_LS_KEY);
    const legacy = legacyRaw ? (JSON.parse(legacyRaw) as { extraPrompt?: unknown }) : null;
    if (typeof legacy?.extraPrompt === 'string' && legacy.extraPrompt.trim()) {
      return saveContentPrompt(legacy.extraPrompt);
    }
  } catch {
    /* 落到空值 */
  }
  return '';
}

export function saveContentPrompt(value: string): string {
  const normalized = normalizeContentPrompt(value);
  writeLs(CONTENT_PROMPT_LS_KEY, normalized);
  return normalized;
}

/** 统一注入块；自定义要求不能越过角色、知识和论坛独立性边界。 */
export function contentDirectorPromptBlock(value: string): string {
  const prompt = normalizeContentPrompt(value).trim();
  if (!prompt) {
    return '';
  }
  return [
    `玩家自定义内容导演要求：\n${prompt}`,
    '执行边界：该要求只调整题材、语气和侧重，不得覆盖角色资料、已发生事实、角色知情范围、论坛与主线的独立性、禁止剧透要求或指定输出格式。',
  ].join('\n');
}

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

function normalizeContentPrompt(value: string): string {
  return String(value ?? '').slice(0, CONTENT_PROMPT_MAX_LENGTH);
}

/* —— generateRaw 集成 —— */

type GenerateRawParams = Parameters<typeof generateRaw>[0];
type CustomApi = NonNullable<GenerateRawParams['custom_api']>;

/** 由 LLM 配置构造 generateRaw 的 custom_api 覆盖；default 模式返回空对象 */
export function buildGenerateExtra(cfg: LlmConfig): Pick<GenerateRawParams, 'custom_api'> {
  if (cfg.mode === 'default') {
    return {};
  }
  const api: CustomApi = {};
  if (cfg.mode === 'preset') {
    if (!cfg.proxyPreset.trim()) {
      return {};
    }
    api.proxy_preset = cfg.proxyPreset.trim();
  } else {
    if (!cfg.apiurl.trim()) {
      return {};
    }
    api.source = 'custom';
    api.apiurl = cfg.apiurl.trim();
    if (cfg.key.trim()) {
      api.key = cfg.key.trim();
    }
  }
  if (cfg.model.trim()) {
    api.model = cfg.model.trim();
  }
  if (cfg.temperature != null) {
    api.temperature = cfg.temperature;
  }
  if (cfg.maxTokens != null) {
    api.max_tokens = cfg.maxTokens;
  }
  return { custom_api: api };
}

/** 设置卡上的状态摘要 */
export function llmStatusText(cfg: LlmConfig): string {
  if (cfg.mode === 'custom') {
    return cfg.apiurl ? `自定义 API${cfg.model ? ` · ${cfg.model}` : ''}` : '自定义 API（未填地址，回退跟随酒馆）';
  }
  if (cfg.mode === 'preset') {
    return cfg.proxyPreset ? `代理预设 · ${cfg.proxyPreset}` : '代理预设（未选择，回退跟随酒馆）';
  }
  return '跟随酒馆当前 API';
}

/** 拉取自定义 API 的模型列表（包一层容错） */
export async function fetchModelList(cfg: LlmConfig): Promise<string[]> {
  if (typeof getModelList !== 'function' || !cfg.apiurl.trim()) {
    return [];
  }
  try {
    return await getModelList({ apiurl: cfg.apiurl.trim(), key: cfg.key.trim() || undefined });
  } catch (error) {
    console.info('[手机·设置] 拉取模型列表失败', error);
    return [];
  }
}

/** 酒馆代理预设名列表（容错） */
export function listProxyPresets(): string[] {
  try {
    if (typeof getProxyPresetNames === 'function') {
      return getProxyPresetNames();
    }
  } catch {
    /* 忽略 */
  }
  return [];
}

/* —— 剧情阶段上下文（来信话题联动） —— */

export interface StoryContext {
  actName: string;
  dateText: string;
  sceneNo: number | null;
  /** 日期窗口覆盖当前日期的场景条目名（找不到则取最近一场） */
  sceneTitle: string;
}

/** 由 MVU 快照 + 世界书场景条目推剧情阶段（供来信/论坛 prompt 使用） */
export async function readStoryContext(snapshot: {
  scene: number | null;
  date: string;
  mode?: string | null;
  timeSlot?: string | null;
}): Promise<StoryContext> {
  const isFree = snapshot.mode === 'free';
  const ctx: StoryContext = {
    actName: isFree ? '开放世界' : actNameOf(snapshot.scene),
    dateText: snapshot.date ? cnDate(snapshot.date) : '',
    sceneNo: snapshot.scene,
    sceneTitle: '',
  };
  try {
    const entries = await loadSceneEntries();
    if (!entries.length) {
      return ctx;
    }
    if (snapshot.date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snapshot.date);
      const cnToday = m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : '';
      const hit = entries.find(e => e.keywords.includes(cnToday));
      if (hit) {
        ctx.sceneTitle = hit.name;
        return ctx;
      }
    }
    // free 模式场景号冻结为 1，序号回退无意义，只做日期命中
    if (!isFree && snapshot.scene != null) {
      // 条目按日期排序 ≈ 场景顺序，取不晚于当前场的最近一条
      const idx = Math.min(snapshot.scene, entries.length) - 1;
      ctx.sceneTitle = entries[Math.max(0, idx)]?.name ?? '';
    }
  } catch {
    /* 忽略 */
  }
  return ctx;
}
