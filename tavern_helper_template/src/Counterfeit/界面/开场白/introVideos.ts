// 前端工程/src/Counterfeit/界面/开场白/introVideos.ts
import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** 视频化序奏播放清单（2026-08-27 三版：Seedance 图生视频，替代静态 CG 运镜 introAssets.ts） */

export type Variant = 'v' | 'h'; // v = 9:16 竖版，h = 16:9 横版

export interface IntroClip {
  /** 程序标识（勿改，测试依赖顺序） */
  key: 'may' | 'spring' | 'summer' | 'winter' | 'heal' | 'grad';
  /** 文件基名（assets 下 <base>_<variant>.mp4 / .webp） */
  base: string;
  /** 左下角字幕·手写体日期行（DOM 叠加，不烧进视频） */
  dateLabel: string;
  /** 停留时长 ms（与视频一致，poster 降级时用它定时切拍） */
  durationMs: number;
}

export const INTRO_CLIPS: IntroClip[] = [
  { key: 'may',    base: 'intro_01_may',    dateLabel: '五月二十日',   durationMs: 5000 },
  { key: 'spring', base: 'intro_02_spring', dateLabel: '春 · 相遇',    durationMs: 5000 },
  { key: 'summer', base: 'intro_03_summer', dateLabel: '夏 · 海边',    durationMs: 5000 },
  { key: 'winter', base: 'intro_04_winter', dateLabel: '十二月二十四日', durationMs: 5000 },
  { key: 'heal',   base: 'intro_05_heal',   dateLabel: '冬末',         durationMs: 5000 },
  { key: 'grad',   base: 'intro_06_grad',   dateLabel: '春 · 卒業',    durationMs: 5000 },
];

export const TITLE_LOOP_BASE = 'title_sakura_loop';
export const TITLE_LOOP = TITLE_LOOP_BASE;

/** 画幅选源：序奏开始时按视口一次选定，中途不随旋转切换。方形按横版处理。 */
export function pickVariant(w: number, h: number): Variant {
  return h > w ? 'v' : 'h';
}

function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}

export function clipVideoUrl(clip: IntroClip, variant: Variant): string {
  return assetUrl(`${clip.base}_${variant}.mp4`);
}

/** 首帧静态图：兼作 video poster 与降级图 */
export function clipPosterUrl(clip: IntroClip, variant: Variant): string {
  return assetUrl(`${clip.base}_${variant}.webp`);
}

export function titleLoopVideoUrl(variant: Variant): string {
  return assetUrl(`${TITLE_LOOP_BASE}_${variant}.mp4`);
}

/** 标题屏 poster 复用现有静态樱花图 */
export function titleLoopPosterUrl(): string {
  return assetUrl('bg_sakura.webp');
}

/** 启动门等待期间预载：第 1 拍视频 + 标题屏循环（其余各拍播放中后台预取） */
export function preloadOpeningAssets(variant: Variant): void {
  for (const src of [clipVideoUrl(INTRO_CLIPS[0], variant), titleLoopVideoUrl(variant)]) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = src;
    video.load();
  }
}

/** 播放中预取下一拍（浏览器按缓存策略处理，重复调用无害） */
export function prefetchClip(index: number, variant: Variant): void {
  const clip = INTRO_CLIPS[index];
  if (!clip) return;
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = clipVideoUrl(clip, variant);
  video.load();
}
