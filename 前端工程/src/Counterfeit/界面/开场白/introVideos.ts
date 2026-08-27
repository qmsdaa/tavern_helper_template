// 前端工程/src/Counterfeit/界面/开场白/introVideos.ts
import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** 视频化序奏播放清单（2026-08-27 单版：Seedance 图生视频 16:9 1080p，替代静态 CG 运镜 introAssets.ts） */

export interface IntroClip {
  /** 程序标识（勿改，测试依赖顺序） */
  key: 'may' | 'spring' | 'summer' | 'winter' | 'heal' | 'grad';
  /** 文件基名（assets 下 <base>.mp4 / .webp） */
  base: string;
  /** 左下角字幕·手写体日期行（DOM 叠加，不烧进视频） */
  dateLabel: string;
  /** 停留时长 ms（与视频一致，poster 降级时用它定时切拍） */
  durationMs: number;
}

export const INTRO_CLIPS: IntroClip[] = [
  { key: 'may',    base: 'intro_01_may',    dateLabel: '五月二十日',   durationMs: 10000 },
  { key: 'spring', base: 'intro_02_spring', dateLabel: '春 · 相遇',    durationMs: 10000 },
  { key: 'summer', base: 'intro_03_summer', dateLabel: '夏 · 海边',    durationMs: 10000 },
  { key: 'winter', base: 'intro_04_winter', dateLabel: '十二月二十四日', durationMs: 10000 },
  { key: 'heal',   base: 'intro_05_heal',   dateLabel: '冬末',         durationMs: 10000 },
  { key: 'grad',   base: 'intro_06_grad',   dateLabel: '春 · 卒業',    durationMs: 10000 },
];

export const TITLE_LOOP_BASE = 'title_sakura_loop';
export const TITLE_LOOP = TITLE_LOOP_BASE;

function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}

export function clipVideoUrl(clip: IntroClip): string {
  return assetUrl(`${clip.base}.mp4`);
}

/** 首帧静态图：兼作 video poster 与降级图 */
export function clipPosterUrl(clip: IntroClip): string {
  return assetUrl(`${clip.base}.webp`);
}

export function titleLoopVideoUrl(): string {
  return assetUrl(`${TITLE_LOOP_BASE}.mp4`);
}

/** 标题屏 poster 复用现有静态樱花图 */
export function titleLoopPosterUrl(): string {
  return assetUrl('bg_sakura.webp');
}

/** 启动门等待期间预载：第 1 拍视频 + 标题屏循环（其余各拍播放中后台预取） */
export function preloadOpeningAssets(): void {
  for (const src of [clipVideoUrl(INTRO_CLIPS[0]), titleLoopVideoUrl()]) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = src;
    video.load();
  }
}

/** 播放中预取下一拍（浏览器按缓存策略处理，重复调用无害） */
export function prefetchClip(index: number): void {
  const clip = INTRO_CLIPS[index];
  if (!clip) return;
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = clipVideoUrl(clip);
  video.load();
}
