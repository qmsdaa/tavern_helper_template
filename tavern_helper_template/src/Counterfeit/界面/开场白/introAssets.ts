import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** OP 风序奏帧定义（2026-07-25 二版：撤掉万花筒，改回总图+面部特写的镜头运动版） */
export interface IntroFrame {
  /** ASSET_BASE 下的文件名 */
  image: string;
  /** 源图宽高比 w/h（特写帧 cover 计算用） */
  ratio: number;
  /** 面部特写焦点（0~1 相对坐标）；有 focus = 特写推镜帧，无 focus = 完整图帧 */
  focus?: [number, number];
  /** 特写推镜倍率（默认 2；动画从 0.92×zoom 推进到 zoom） */
  zoom?: number;
  /** 停留时长 ms */
  duration: number;
  /** 收束帧：虹膜展开（circle clip-path）后定格完整图 */
  full?: boolean;
  /** 离场特效：heal = 「走出创伤」长转场（推近右下角玩具熊的暖光点 + 渐白，2.8s） */
  transitionOut?: 'heal';
}

export const INTRO_ASPECT = {
  group: 2048 / 1520,
  grid: 1672 / 941,
  selfie: 1648 / 2048,
} as const;

/** 「走出创伤」转场时长 ms（⑥物证格 → ⑧自拍合照之间） */
export const HEAL_DURATION = 2800;

/** 帧序列：群像全景 → 四人面部特写（八幡/雪乃/结衣/拉芙压轴）→ ⑤创伤格 → ⑥物证格 →（走出创伤）→ ⑧自拍收束。
 *  ⑦四小只帧已按作者裁定移除（风格不合；单独立绘仍保留在画廊）。 */
export const INTRO_FRAMES: IntroFrame[] = [
  { image: 'intro_group.webp', ratio: INTRO_ASPECT.group, duration: 1600 },
  { image: 'intro_group.webp', ratio: INTRO_ASPECT.group, focus: [0.165, 0.24], zoom: 2.4, duration: 1050 },
  { image: 'intro_group.webp', ratio: INTRO_ASPECT.group, focus: [0.36, 0.165], zoom: 2.4, duration: 1050 },
  { image: 'intro_group.webp', ratio: INTRO_ASPECT.group, focus: [0.815, 0.3], zoom: 2.4, duration: 1050 },
  { image: 'intro_group.webp', ratio: INTRO_ASPECT.group, focus: [0.63, 0.175], zoom: 2.4, duration: 1300 },
  { image: 'intro_trauma.webp', ratio: INTRO_ASPECT.grid, full: true, duration: 2800 },
  { image: 'intro_token.webp', ratio: INTRO_ASPECT.grid, full: true, duration: 2600, transitionOut: 'heal' },
  { image: 'intro_selfie.webp', ratio: INTRO_ASPECT.selfie, full: true, duration: 2800 },
];

export function introAssetUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}

/** 序奏素材预加载（启动门挂载时调用，避免序奏中途卡图） */
export function preloadIntroAssets(): void {
  for (const frame of INTRO_FRAMES) {
    const img = new Image();
    img.src = introAssetUrl(frame.image);
  }
}
