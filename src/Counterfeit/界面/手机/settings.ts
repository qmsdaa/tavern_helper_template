// 手机助手 · 本地设置（LLM 模型配置 + NPC 互动设置）
// 持久化只用 localStorage、不写 MVU 聊天变量：
//   ① API key 属于敏感信息，写进 stat_data 会随聊天记录导出泄露；
//   ② 设置属于设备偏好（同悬浮球位置），换剧情档不该跟着走。
import { actNameOf, cnDate, loadSceneEntries } from './vars';

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
  /** 来信好感门槛（0-100，低于此值的好友不会主动来信） */
  affectionGate: number;
  /** 完成一次对话好感 +1 */
  affectionGain: boolean;
  /** 回复引用的历史消息条数 */
  historyLength: number;
  /** 附加提示词（拼接进回复/来信的 prompt，空＝无） */
  extraPrompt: string;
}

export const DEFAULT_NPC_SETTINGS: NpcSettings = {
  proactiveEnabled: true,
  proactiveChance: 35,
  cooldownMinutes: 3,
  affectionGate: 30,
  affectionGain: true,
  historyLength: 8,
  extraPrompt: '',
};

/* —— 读写 —— */

const LLM_LS_KEY = 'counterfeit.phone.llm';
const NPC_LS_KEY = 'counterfeit.phone.npc';

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
  s.affectionGate = clamp(Math.round(s.affectionGate), 0, 100);
  s.historyLength = clamp(Math.round(s.historyLength), 2, 20);
  return s;
}

export function saveNpcSettings(s: NpcSettings) {
  writeLs(NPC_LS_KEY, s);
}

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
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
}): Promise<StoryContext> {
  const ctx: StoryContext = {
    actName: actNameOf(snapshot.scene),
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
    if (snapshot.scene != null) {
      // 条目按日期排序 ≈ 场景顺序，取不晚于当前场的最近一条
      const idx = Math.min(snapshot.scene, entries.length) - 1;
      ctx.sceneTitle = entries[Math.max(0, idx)]?.name ?? '';
    }
  } catch {
    /* 忽略 */
  }
  return ctx;
}
