// 前端工程/src/Counterfeit/界面/开场白/audio.ts
import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** BGM 全长（秒）。bgm.mp3 与 OP 成片音轨是同一条曲子同一时间轴
 *  （2026-08-31 验证：239.76s vs 239.84s，能量包络互相关 0.937 @ lag 0），
 *  OP 画面段播完后由标题屏从交接位置续播，体验等同完整 240s OP。 */
export const BGM_DURATION = 239.76;

// BGM 单例：跨界面步骤持续播放（恢复最早版本"标题屏控制 BGM"行为）。
let audio: HTMLAudioElement | null = null;

export function getBgm(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(`${ASSET_BASE}/bgm.mp3?v=${ASSET_VERSION}`);
    audio.loop = true;
    audio.volume = 0.55;
    audio.preload = 'auto';
  }
  return audio;
}

/** 启动门首次点击时调用：借用户手势把 bgm 元素"点透"（静音播一下即停），
 *  之后 OP→标题屏交接时的程序化 play() 才不会被浏览器 autoplay 策略拦截。 */
export function primeBgm(): void {
  const bgm = getBgm();
  const vol = bgm.volume;
  bgm.volume = 0;
  bgm
    .play()
    .then(() => {
      bgm.pause();
      bgm.currentTime = 0;
      bgm.volume = vol;
    })
    .catch(() => {
      bgm.volume = vol;
    });
}

/** 从指定位置续播（OP 交接用）；失败时保持暂停，由标题屏音乐按钮兜底手动开启 */
export async function playBgmFrom(seconds: number): Promise<boolean> {
  const bgm = getBgm();
  try {
    bgm.currentTime = seconds % BGM_DURATION;
  } catch {
    // metadata 未就绪时 seek 可能失败，退回从头播
  }
  try {
    await bgm.play();
    return true;
  } catch (error) {
    console.warn('[开场白] BGM 续播失败', error);
    return false;
  }
}
