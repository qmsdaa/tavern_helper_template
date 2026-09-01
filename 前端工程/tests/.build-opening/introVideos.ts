// 前端工程/src/Counterfeit/界面/开场白/introVideos.ts
import { ASSET_BASE, ASSET_VERSION } from './config.ts';

/** 开场白 OP（2026-08-31 v2 换新成片：85.4s，音轨与 bgm.mp3 同曲同时轴 0.999@lag0；
 *  画面播完即白幕收束，BGM 由标题屏从交接位置续播 bgm.mp3——与 OP 音轨同一条曲子）。
 *  双画幅源：桌面 16:9（op_desktop，1080p 1250k）/ 移动竖屏模糊填充（op_mobile，900k），按视口画幅选择。 */

/** OP 画面段时长（秒）：到点即收束进标题屏（视频本身 85.4s，ended 事件兜底） */
export const OP_PICTURE_END = 85.4;

export const OP_DESKTOP_BASE = 'op_desktop';
export const OP_MOBILE_BASE = 'op_mobile';

export const TITLE_LOOP_BASE = 'title_sakura_loop';
export const TITLE_LOOP = TITLE_LOOP_BASE;

function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}

/** 竖屏视口用移动版（1080×1920），其余用桌面 16:9 版；node 测试环境无 window，默认桌面版 */
export function isPortraitViewport(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
}

export function opVideoBase(): string {
  return isPortraitViewport() ? OP_MOBILE_BASE : OP_DESKTOP_BASE;
}

export function opVideoUrl(): string {
  return assetUrl(`${opVideoBase()}.mp4`);
}

/** OP 首帧静态图：作 video poster，加载期占位避免黑屏 */
export function opPosterUrl(): string {
  return assetUrl(`${opVideoBase()}.webp`);
}

export function titleLoopVideoUrl(): string {
  return assetUrl(`${TITLE_LOOP_BASE}.mp4`);
}

/** 标题屏 poster 复用现有静态樱花图 */
export function titleLoopPosterUrl(): string {
  return assetUrl('bg_sakura.webp');
}

/** 启动门等待期间预载：OP 视频 + 标题屏循环 */
export function preloadOpeningAssets(): void {
  for (const src of [opVideoUrl(), titleLoopVideoUrl()]) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = src;
    video.load();
  }
}
