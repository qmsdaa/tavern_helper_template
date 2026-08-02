// 文案统一入口：所有用户可改文本集中在 copy.yaml（主副本 = 项目根《开场白文案.config.yaml》）
import copy from './copy.yaml';
import { GENERATED_GALLERY_ITEMS } from './gallery.generated';

export interface TitleSegment {
  text: string;
  color: string;
}

export interface TitleCopy {
  /** 每行拆若干彩色分段（轻小说 logo 风），白色描边统一保留 */
  lines: { segments: TitleSegment[] }[];
  subtitle: string;
}

export interface PovCopy {
  key: 'hachiman' | 'yukino' | 'yui' | 'laff';
  name: string;
  portrait: string;
  /** 定位标签，如「地面·托底」 */
  role: string;
  /** 无剧透的一句话简介 */
  tagline: string;
  /** 独占内容简述（仅 laff，刻意保持模糊、不剧透结局） */
  exclusive?: string;
}

export interface GalleryCopyItem {
  title: string;
  caption: string;
  image: string | null;
}

/** 玩法模式（剧本 / 开放世界）文案 */
export interface GameModeCopy {
  label: string;
  desc: string;
}

interface CopyFile {
  title: TitleCopy;
  modes: { story: GameModeCopy; open: GameModeCopy };
  povs: PovCopy[];
  openings: Record<PovCopy['key'], string> & { custom: string };
  gallery: { title: string; hint: string; items: GalleryCopyItem[] };
}

const COPY = copy as CopyFile;

export const TITLE_COPY = COPY.title;
export const MODE_COPY = COPY.modes;
export const POV_LIST = COPY.povs;
export const OPENING_TEXTS = COPY.openings;
/** 画廊条目：优先用脚本生成的真实图片清单（assets/tools/build_gallery.py），空则回退 copy.yaml 占位项 */
export const GALLERY_COPY = {
  ...COPY.gallery,
  items: (GENERATED_GALLERY_ITEMS.length > 0 ? GENERATED_GALLERY_ITEMS : COPY.gallery.items) as GalleryCopyItem[],
};

export type PovKey = PovCopy['key'];

export function povByKey(key: PovKey): PovCopy {
  return POV_LIST.find(p => p.key === key) ?? POV_LIST[0];
}

/** 渲染自建角色开场文本：替换 {{姓名}} 占位符 */
export function renderCustomOpening(name: string): string {
  const display = name.trim() || '我';
  return OPENING_TEXTS.custom.replaceAll('{{姓名}}', display);
}
