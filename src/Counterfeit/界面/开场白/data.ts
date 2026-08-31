import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** 立绘/素材完整 URL（文件位于 ASSET_BASE 下，附版本号破缓存）。
 *  2026-08-23 起支持绝对 URL 直填（用于把单张图迁到 cdn 素材仓库而不搬整个开场白目录） */
export function portraitUrl(file: string): string {
  if (/^https?:\/\//.test(file)) return file;
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}
