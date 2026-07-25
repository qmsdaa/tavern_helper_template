// MVU 变量读取（容错：无 MVU 环境时返回空快照）
// 对齐 MVU-DESIGN v0.4.2：mode / current_pov / custom_protagonist / current_scene / current_date / affection_*
import { ASSET_BASE } from '../../config';

/** 素材完整 URL（文件位于 ASSET_BASE 下） */
export function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}`;
}

export interface MvuSnapshot {
  mode: 'pov' | 'custom' | null;
  pov: string | null;
  customName: string;
  scene: number | null;
  date: string;
  affection: Record<string, number>;
  hasMvu: boolean;
}

const POV_NAMES: Record<string, string> = {
  hachiman: '比企谷八幡',
  yukino: '雪之下雪乃',
  yui: '由比滨结衣',
  laff: '拉芙希妮·都柏林',
};

export const AFFECTION_LABELS: Record<string, string> = {
  affection_hachiman: '八幡',
  affection_yukino: '雪乃',
  affection_yui: '结衣',
  affection_laff: '拉芙希妮',
  affection_iroha: '一色',
};

/** 十幕区间（与 WORKFLOW §大纲总览一致） */
const ACT_TABLE: [number, string][] = [
  [10, '第一幕 · 入部·磨合'],
  [25, '第二幕 · 暑夏·林间学校'],
  [61, '第三幕 · 二学期'],
  [77, '第四幕 · 冬假→三学期'],
  [92, '第五幕 · PTA→舞会·开战'],
  [98, '第六幕 · 春假战备'],
  [119, '第七幕 · 重新为奉仕部命名'],
  [126, '第八幕 · 归国与失语'],
  [133, '第九幕 · 以自己的名字委托'],
  [150, '第十幕 · 冬去春来'],
];

export function emptySnapshot(): MvuSnapshot {
  return { mode: null, pov: null, customName: '', scene: null, date: '', affection: {}, hasMvu: false };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readStatData(): Record<string, any> {
  try {
    if (typeof getVariables !== 'function') {
      return {};
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = getVariables({ type: 'chat' } as any) ?? {};
    return (v as Record<string, any>).stat_data ?? (v as Record<string, any>);
  } catch {
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
  snap.scene = typeof sd.current_scene === 'number' ? sd.current_scene : null;
  snap.date = String(sd.current_date ?? '');
  for (const key of Object.keys(AFFECTION_LABELS)) {
    if (typeof sd[key] === 'number') {
      snap.affection[key] = sd[key] as number;
    }
  }
  return snap;
}

export function povDisplayName(key: string | null): string {
  return (key && POV_NAMES[key]) || '';
}

/** 好感档位（galgame 系统设计 §6.4：陌生 <30 / 熟悉 30-59 / 信任 60-79 / 心动 ≥80） */
export function affectionTier(value: number): string {
  if (value < 30) return '陌生';
  if (value < 60) return '熟悉';
  if (value < 80) return '信任';
  return '心动';
}

export function actNameOf(scene: number | null): string {
  if (scene == null) return '';
  for (const [end, name] of ACT_TABLE) {
    if (scene <= end) return name;
  }
  return '';
}

/** ISO 日期 → "2013年5月20日" */
export function cnDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/* —— v2：世界书 / 好友 / 章节 —— */

/** 好友名 → 好感变量字段 */
export const AFFECTION_FIELD_BY_NAME: Record<string, string> = {
  比企谷八幡: 'affection_hachiman',
  雪之下雪乃: 'affection_yukino',
  由比滨结衣: 'affection_yui',
  拉芙希妮: 'affection_laff',
  一色彩羽: 'affection_iroha',
};

const MAIN_FOUR = ['比企谷八幡', '雪之下雪乃', '由比滨结衣', '拉芙希妮'];
const POV_EXCLUDE: Record<string, string> = {
  hachiman: '比企谷八幡',
  yukino: '雪之下雪乃',
  yui: '由比滨结衣',
  laff: '拉芙希妮',
};

export interface FriendMeta {
  name: string;
  tint: string;
}

const FRIEND_TINTS = [
  'linear-gradient(145deg, #64b5f6, #3b82d6)',
  'linear-gradient(145deg, #f8bbd0, #ec5f92)',
  'linear-gradient(145deg, #ffd54f, #f0a53a)',
  'linear-gradient(145deg, #b39ddb, #7e57c2)',
  'linear-gradient(145deg, #5ee08a, #28c76f)',
];

/** 按当前 MVU 快照算好友列表（排除玩家角色；八幡玩家与自建含一色） */
export function computeFriends(snap: MvuSnapshot): FriendMeta[] {
  const names = MAIN_FOUR.filter(n => n !== (POV_EXCLUDE[snap.pov ?? ''] ?? ''));
  if (!snap.hasMvu || snap.mode === 'custom' || snap.pov === 'hachiman') {
    names.push('一色彩羽');
  }
  return names.map((name, i) => ({ name, tint: FRIEND_TINTS[i % FRIEND_TINTS.length] }));
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

/** 读取世界书 [手机]xxx 条目 → 好友名→persona 文本 */
export async function loadPersonaMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const book = await resolveWorldbookName();
    if (!book || typeof getWorldbook !== 'function') {
      return map;
    }
    const entries = await getWorldbook(book);
    for (const e of entries) {
      const m = /^\[手机\](.+)$/.exec(e.name ?? '');
      if (m) {
        map[m[1].trim()] = String(e.content ?? '');
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
