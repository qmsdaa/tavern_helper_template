// MVU 变量读取（容错：无 MVU 环境时返回空快照）
// 对齐 MVU-DESIGN v0.5.1：world / player / 动态 characters；phone 仍由手机 store 独占写入
import { ASSET_BASE, ASSET_VERSION, AVATAR_BASE } from '../../config';

/** 素材完整 URL（文件位于 ASSET_BASE 下） */
export function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}`;
}

/** 规范全名 → 好友头像文件名（assets/Counterfeit/手机/avatars/<name>.webp，仅 POV 四主角有素材） */
const AVATAR_KEYS: Record<string, string> = {
  '比企谷八幡': 'hachiman',
  '雪之下雪乃': 'yukino',
  '由比滨结衣': 'yui',
  '拉芙希妮·都柏林': 'laff',
};

/** 好友头像 URL；无素材的联系人返回 null（UI 回退为渐变底 + 名字首字） */
export function avatarUrlFor(canonicalName: string): string | null {
  const file = AVATAR_KEYS[canonicalName];
  return file ? `${AVATAR_BASE}/${file}.webp?v=${ASSET_VERSION}` : null;
}

/**
 * 剥离世界书条目里的 EJS：手机 iframe 没有 getvar，原样注入会在 generate 模板编译期炸掉
 * （截断在 <% 块中间 → Unexpected token）。
 * 规则：if/else 条件链整段删除（含内部文本——阶段/恋人叠加层只应出现在主线渲染结果里，
 * 手机拿不到条件真值，与其泄漏全部叠加层，不如只保留基础层）；纯逻辑标签（getvar 等）
 * 只删标签、保留标签之间的正文。
 */
function stripEjs(content: string): string {
  const tagRe = /<%[-_=]?[\s\S]*?[-_]?%>/g;
  let out = '';
  let cursor = 0;
  let depth = 0;
  for (const match of content.matchAll(tagRe)) {
    const index = match.index ?? 0;
    const inner = match[0].replace(/^<%[-_=]?/, '').replace(/[-_]?%>$/, '').trim();
    const isIfOpen = /^if\s*\(/.test(inner);
    const isChainMiddle = /^\}\s*else\b/.test(inner);
    const isClose = /^\}/.test(inner) && !isChainMiddle;
    if (depth === 0) {
      out += content.slice(cursor, index);
      cursor = index + match[0].length;
      if (isIfOpen) {
        depth = 1;
      }
    } else {
      if (isIfOpen) {
        depth += 1;
      } else if (isClose) {
        depth -= 1;
        if (depth === 0) {
          cursor = index + match[0].length;
        }
      }
    }
  }
  out += content.slice(cursor);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export type Commitment = '未确认' | '仅朋友' | '恋人';

export interface RelationshipSnapshot {
  bond: number;
  romance: number;
  commitment: Commitment;
}

export interface LatestUserMemorySnapshot {
  memory: string;
  inner_thought: string;
}

export interface OutfitSnapshot {
  outerwear: string;
  inner_layer: string;
  bottoms: string;
  socks: string;
  underwear: string;
  shoes: string;
}

export interface CharacterSnapshot {
  display_name: string;
  present: boolean;
  known: boolean;
  relationship: RelationshipSnapshot;
  latest_user_memory: LatestUserMemorySnapshot;
  outfit: OutfitSnapshot;
}

export interface MvuSnapshot {
  mode: 'pov' | 'custom' | 'free' | null;
  pov: string | null;
  playerName: string;
  customName: string;
  scene: number | null;
  date: string;
  location: string;
  /** 仅 free 模式使用（早晨|上午|午休|放课后|傍晚|晚间），其余模式恒 null */
  timeSlot: string | null;
  cash: number | null;
  carriedItems: string[];
  characters: Record<string, CharacterSnapshot>;
  hasMvu: boolean;
}

const POV_NAMES: Record<string, string> = {
  hachiman: '比企谷八幡',
  yukino: '雪之下雪乃',
  yui: '由比滨结衣',
  laff: '拉芙希妮·都柏林',
};

/** 十幕区间（与 WORKFLOW §大纲总览一致） */
const ACT_TABLE: [number, string][] = [
  [10, '第一幕 · 入部磨合'],
  [25, '第二幕 · 暑夏林间学校'],
  [61, '第三幕 · 二学期'],
  [77, '第四幕 · 冬假三学期'],
  [92, '第五幕 · PTA与舞会'],
  [98, '第六幕 · 春假战备'],
  [119, '第七幕 · 重新为奉仕部命名'],
  [126, '第八幕 · 归国与失语'],
  [133, '第九幕 · 以自己的名字委托'],
  [150, '第十幕 · 冬去春来'],
];

export function emptySnapshot(): MvuSnapshot {
  return {
    mode: null,
    pov: null,
    playerName: '',
    customName: '',
    scene: null,
    date: '',
    location: '',
    timeSlot: null,
    cash: null,
    carriedItems: [],
    characters: {},
    hasMvu: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function boundedNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function normalizeCharacter(canonicalName: string, value: unknown): CharacterSnapshot {
  const source = isRecord(value) ? value : {};
  const relationship = isRecord(source.relationship) ? source.relationship : {};
  const memory = isRecord(source.latest_user_memory) ? source.latest_user_memory : {};
  const outfit = isRecord(source.outfit) ? source.outfit : {};
  const rawCommitment = asText(relationship.commitment);
  const commitment: Commitment = ['未确认', '仅朋友', '恋人'].includes(rawCommitment)
    ? (rawCommitment as Commitment)
    : '未确认';

  return {
    display_name: asText(source.display_name, canonicalName) || canonicalName,
    present: source.present === true,
    known: source.known === true,
    relationship: {
      bond: boundedNumber(relationship.bond),
      romance: boundedNumber(relationship.romance),
      commitment,
    },
    latest_user_memory: {
      memory: asText(memory.memory),
      inner_thought: asText(memory.inner_thought),
    },
    outfit: {
      outerwear: asText(outfit.outerwear, '未确认') || '未确认',
      inner_layer: asText(outfit.inner_layer, '未确认') || '未确认',
      bottoms: asText(outfit.bottoms, '未确认') || '未确认',
      socks: asText(outfit.socks, '未确认') || '未确认',
      underwear: asText(outfit.underwear, '未确认') || '未确认',
      shoes: asText(outfit.shoes, '未确认') || '未确认',
    },
  };
}

/** 判定某变量表里是否真的含 MVU 状态（避免把只有 phone 容器的聊天变量误当快照） */
function isMvuStatData(value: Record<string, any>): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value.mode !== undefined ||
        value.current_pov !== undefined ||
        value.world !== undefined ||
        value.player !== undefined ||
        value.characters !== undefined),
  );
}

function extractStatData(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const record = raw as Record<string, any>;
  // 楼层变量形如 {stat_data: {...}}；聊天基线可能是平铺或同样套在 stat_data 下
  const wrapped = record.stat_data;
  return wrapped && typeof wrapped === 'object' ? wrapped : record;
}

/**
 * Bug2：MVU 变量抓取多级回退。
 * 1) 最新消息楼层的 stat_data（MVU 更新块写入处；手机自身只写 chat 级 phone 容器）
 * 2) 回退：从最新往旧遍历消息，找最近一个含完整 stat_data 的楼层（首轮/楼清空时 latest 为 null）
 * 3) 聊天级基线（仍无效则返回空快照，界面显示占位）
 */
function readStatData(): Record<string, any> {
  try {
    if (typeof getVariables !== 'function') {
      return {};
    }
    const latest = getVariables({ type: 'message', message_id: 'latest' } as any) ?? {};
    const latestSd = extractStatData(latest);
    if (isMvuStatData(latestSd)) {
      return latestSd;
    }
    // 楼层回退：遍历消息 data.stat_data（含部分更新块的楼层也要跳过，直到找到完整快照）
    if (typeof getChatMessages === 'function') {
      const messages = getChatMessages() as unknown[];
      for (let i = messages.length - 1; i >= 0; i--) {
        const stat = (messages[i] as { data?: { stat_data?: unknown } } | null)?.data?.stat_data;
        const sd = extractStatData(stat);
        if (isMvuStatData(sd)) {
          return sd;
        }
      }
    }
    const chat = getVariables({ type: 'chat' } as any) ?? {};
    const chatSd = extractStatData(chat);
    if (isMvuStatData(chatSd)) {
      return chatSd;
    }
    console.warn('[手机·变量] 未找到完整 MVU 快照（楼层与聊天变量均无有效 stat_data）');
    return {};
  } catch (error) {
    console.warn('[手机·变量] readStatData 失败', error);
    return {};
  }
}

export function readMvuSnapshot(): MvuSnapshot {
  const sd = readStatData();
  const snap = emptySnapshot();
  if (!Object.keys(sd).length) {
    return snap;
  }
  snap.hasMvu = true;
  snap.mode = (sd.mode as MvuSnapshot['mode']) ?? null;
  snap.pov = (sd.current_pov as string) ?? null;
  snap.customName = String(sd.custom_protagonist?.name ?? '');
  snap.playerName = snap.customName || povDisplayName(snap.pov) || '';
  snap.scene = typeof sd.current_scene === 'number' ? sd.current_scene : null;
  snap.date = asText(sd.world?.current_date);
  snap.location = asText(sd.world?.current_location);
  snap.timeSlot = snap.mode === 'free' ? asText(sd.world?.time_slot) || null : null;
  const cash = sd.player?.cash;
  snap.cash = cash === null || cash === undefined || !Number.isFinite(Number(cash)) ? null : Math.max(0, Number(cash));
  snap.carriedItems = Array.isArray(sd.player?.carried_items)
    ? sd.player.carried_items.filter((item: unknown): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
  if (isRecord(sd.characters)) {
    snap.characters = Object.fromEntries(
      Object.entries(sd.characters).map(([canonicalName, value]) => [
        canonicalName,
        normalizeCharacter(canonicalName, value),
      ]),
    );
  }
  return snap;
}

export function povDisplayName(key: string | null): string {
  return (key && POV_NAMES[key]) || '';
}

/** 关系档位与外部状态栏一致；romance 只参与叙事判断，不直接暴露为 UI 标签。 */
export function relationshipTier(relationship: RelationshipSnapshot): string {
  if (relationship.commitment === '恋人') return '恋人';
  if (relationship.commitment === '仅朋友') return '朋友';
  if (relationship.bond >= 80) return '亲近';
  if (relationship.bond >= 60) return '信赖';
  if (relationship.bond >= 30) return '熟悉';
  return '初识';
}

export function formatCash(value: number | null): string {
  return value == null ? '未确认' : `¥${value.toLocaleString('ja-JP')}`;
}

export function actNameOf(scene: number | null): string {
  if (scene == null) return '';
  for (const [end, name] of ACT_TABLE) {
    if (scene <= end) return name;
  }
  return '';
}

/** 阶段/时段描述：free 模式场景号冻结为 1，幕表失真，改用开放世界+时段 */
export function stageText(snap: Pick<MvuSnapshot, 'mode' | 'scene' | 'timeSlot'>): string {
  if (snap.mode === 'free') {
    return snap.timeSlot ? `开放世界 · ${snap.timeSlot}` : '开放世界';
  }
  return actNameOf(snap.scene);
}

/** ISO 日期 → "2013年5月20日" */
export function cnDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/* —— 世界书 / 角色资料 / 章节 —— */

const FRIEND_TINTS = [
  'linear-gradient(145deg, #64b5f6, #3b82d6)',
  'linear-gradient(145deg, #f8bbd0, #ec5f92)',
  'linear-gradient(145deg, #ffd54f, #f0a53a)',
  'linear-gradient(145deg, #b39ddb, #7e57c2)',
  'linear-gradient(145deg, #5ee08a, #28c76f)',
];

export function tintForName(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FRIEND_TINTS[hash % FRIEND_TINTS.length];
}

/** 解析角色卡绑定的世界书名（容错） */
export async function resolveWorldbookName(): Promise<string | null> {
  try {
    if (typeof getCharWorldbookNames === 'function') {
      const names = getCharWorldbookNames('current' as Parameters<typeof getCharWorldbookNames>[0]);
      if (names?.primary) {
        return names.primary;
      }
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 读取世界书角色/NPC条目；兼容旧 [手机]xxx 条目。 */
export async function loadPersonaMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const book = await resolveWorldbookName();
    if (!book || typeof getWorldbook !== 'function') {
      return map;
    }
    const entries = await getWorldbook(book);
    for (const e of entries) {
      const entryName = String(e.name ?? '').trim();
      const phoneMatch = /^\[手机\](.+)$/.exec(entryName);
      const roleMatch = /^(.+)_(?:基础信息|性格调色盘|三面性)$/.exec(entryName);
      const canonical = phoneMatch?.[1]?.trim() || roleMatch?.[1]?.trim();
      if (canonical) {
        map[canonical] = [map[canonical], stripEjs(String(e.content ?? ''))].filter(Boolean).join('\n\n');
        continue;
      }
      if (
        e.position?.type === 'after_character_definition' &&
        entryName &&
        !entryName.includes('_') &&
        !/^其他/.test(entryName)
      ) {
        map[entryName] = [map[entryName], stripEjs(String(e.content ?? ''))].filter(Boolean).join('\n\n');
      }
    }
  } catch {
    /* 忽略 */
  }
  return map;
}

export interface SceneEntry {
  name: string;
  /** 3 日窗口关键词（YYYY年M月D日） */
  keywords: string[];
}

/** 读取世界书场景条目（名称以"场景"开头，提取日期关键词） */
export async function loadSceneEntries(): Promise<SceneEntry[]> {
  const list: SceneEntry[] = [];
  try {
    const book = await resolveWorldbookName();
    if (!book || typeof getWorldbook !== 'function') {
      return list;
    }
    const entries = await getWorldbook(book);
    for (const e of entries) {
      if (!/^场景/.test(e.name ?? '')) {
        continue;
      }
      const keys = Array.isArray(e.strategy?.keys) ? e.strategy.keys.map(String) : [];
      list.push({ name: e.name, keywords: keys.filter(k => /^\d{4}年\d{1,2}月\d{1,2}日$/.test(k)) });
    }
  } catch {
    /* 忽略 */
  }
  return list;
}

/** 中文日期（2013年5月20日）→ ISO（2013-05-20）；失败返回空串 */
export function isoFromCnDate(text: string): string {
  const m = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(text);
  if (!m) {
    return '';
  }
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}
