// Counterfeit · 状态栏纯函数工具：幕名映射 / 日期星期 / 关系阶段 / 在场角色视图模型
import { ASSET_VERSION, PORTRAIT_BASE } from '../../config';
import type { Schema } from '../../schema';

/** 十幕区间（与 EJS 状态栏渲染及 WORKFLOW §大纲总览完全一致，不得自行改名） */
const ACT_TABLE: ReadonlyArray<readonly [number, string]> = [
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

export function actNameOf(scene: number): string {
  for (const [upper, name] of ACT_TABLE) {
    if (scene <= upper) {
      return name;
    }
  }
  return ACT_TABLE[ACT_TABLE.length - 1][1];
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** YYYY-MM-DD → "YYYY-MM-DD · 星期X"；无法解析时原样返回 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return `${dateStr} · 星期${WEEK_LABELS[date.getDay()]}`;
}

const POV_NAMES: Record<string, string> = {
  hachiman: '比企谷八幡',
  yukino: '雪之下雪乃',
  yui: '由比滨结衣',
  laff: '拉芙希妮·都柏林',
};

export function playerLabel(data: Schema): string {
  if (data.mode === 'pov') {
    return (data.current_pov && POV_NAMES[data.current_pov]) || '未选择';
  }
  const customName = data.custom_protagonist?.name;
  return customName ? `${customName}（自建）` : '未选择';
}

export function cashLabel(cash: number | null): string {
  return cash === null || typeof cash === 'undefined' ? '未确认' : `¥${cash.toLocaleString('ja-JP')}`;
}

export function bondTier(bond: number): string {
  if (bond >= 80) return '亲近';
  if (bond >= 60) return '信赖';
  if (bond >= 30) return '熟悉';
  return '初识';
}

type CharacterRecord = Schema['characters'][string];

/**
 * 关系阶段标签：只看 commitment 与 bond，绝不根据 romance 派生"暧昧/喜欢"等标签
 * （与 EJS 状态栏及 MVU 更新规则一致）
 */
export function relationshipLabel(record: CharacterRecord): string {
  const relation = record.relationship;
  if (relation.commitment === '恋人') return '恋人';
  if (relation.commitment === '仅朋友') return '朋友';
  return bondTier(relation.bond);
}

export const MEMORY_EMPTY_PLACEHOLDER = '还没有留下足以反复想起的片段';
export const THOUGHT_EMPTY_PLACEHOLDER = '……';

/** 规范全名（characters 记录键）→ 立绘文件名（assets/Counterfeit/状态栏/portraits/<name>.webp） */
const PORTRAIT_KEYS: Record<string, string> = {
  '比企谷八幡': 'hachiman',
  '雪之下雪乃': 'yukino',
  '由比滨结衣': 'yui',
  '拉芙希妮·都柏林': 'laff',
  '一色彩羽': 'iroha',
  '三浦优美子': 'yumiko',
  '叶山隼人': 'hayama',
  '平冢静': 'shizuka',
  '户冢彩加': 'saika',
  '雪之下阳乃': 'haruno',
  '爱布拉娜': 'eblana',
  '爱布拉娜·都柏林': 'eblana',
  '比企谷小町': 'komachi',
};

/** 角色立绘 URL；无立绘素材的角色返回 null（UI 回退为名字首字占位） */
export function portraitUrlOf(canonicalName: string): string | null {
  const file = PORTRAIT_KEYS[canonicalName];
  return file ? `${PORTRAIT_BASE}/${file}.webp?v=${ASSET_VERSION}` : null;
}

export interface PresentCharacterView {
  /** 世界书规范全名（characters 记录键） */
  key: string;
  displayName: string;
  label: string;
  bond: number;
  romance: number;
  commitment: '未确认' | '仅朋友' | '恋人';
  memory: string;
  innerThought: string;
  outfit: {
    outerwear: string;
    inner_layer: string;
    bottoms: string;
    socks: string;
    underwear: string;
    shoes: string;
  };
  /** 立绘 URL；无素材时为 null（UI 显示 displayName 首字占位） */
  portraitUrl: string | null;
}

/** 仅保留"在场且已认识"的角色；known=false 的角色连规范姓名都不得出现在视图模型里 */
export function presentCharacters(data: Schema): PresentCharacterView[] {
  return Object.entries(data.characters)
    .filter(([, record]) => record && record.present === true && record.known === true)
    .map(([canonicalName, record]) => ({
      key: canonicalName,
      displayName: record.display_name || canonicalName,
      label: relationshipLabel(record),
      bond: record.relationship.bond,
      romance: record.relationship.romance,
      commitment: record.relationship.commitment,
      memory: record.latest_user_memory?.memory || '',
      innerThought: record.latest_user_memory?.inner_thought || '',
      outfit: {
        outerwear: record.outfit?.outerwear || '未确认',
        inner_layer: record.outfit?.inner_layer || '未确认',
        bottoms: record.outfit?.bottoms || '未确认',
        socks: record.outfit?.socks || '未确认',
        underwear: record.outfit?.underwear || '未确认',
        shoes: record.outfit?.shoes || '未确认',
      },
      portraitUrl: portraitUrlOf(canonicalName),
    }));
}

export type HammerKey = Extract<keyof Schema, `hammer_${string}`>;

export interface HammerView {
  key: HammerKey;
  emoji: string;
  name: string;
  state: 'pending' | 'triggered' | 'missed';
}

const HAMMER_DEFS: ReadonlyArray<readonly [HammerKey, string, string]> = [
  ['hammer_thunder_1', '⛈️', '打雷 #1'],
  ['hammer_tea_1', '🍵', '甜红茶 #1'],
  ['hammer_tea_2', '🍵', '甜红茶 #2'],
  ['hammer_teddy_1', '🧸', '玩具熊 #1'],
  ['hammer_thunder_2', '⛈️', '打雷 #2'],
  ['hammer_outcast_1', '🔥', 'Outcast #1'],
  ['hammer_teddy_2', '🧸', '玩具熊 #2'],
  ['hammer_outcast_2', '🔥', 'Outcast #2'],
  ['hammer_tea_3', '🍵', '甜红茶 #3'],
];

export const HAMMER_STATE_LABELS = {
  pending: '待触发',
  triggered: '已触发',
  missed: '已错过',
} as const;

export function hammerViews(data: Schema): HammerView[] {
  return HAMMER_DEFS.map(([key, emoji, name]) => ({ key, emoji, name, state: data[key] }));
}
