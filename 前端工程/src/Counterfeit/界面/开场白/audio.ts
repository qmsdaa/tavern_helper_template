import { ASSET_BASE, ASSET_VERSION } from '../../config';

// BGM 单例：跨界面步骤持续播放；浏览器 autoplay 限制下，首次用户点击开关后启动。
let audio: HTMLAudioElement | null = null;

export function getBgm(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(`${ASSET_BASE}/bgm.mp3?v=${ASSET_VERSION}`);
    audio.loop = true;
    audio.volume = 0.55;
  }
  return audio;
}
