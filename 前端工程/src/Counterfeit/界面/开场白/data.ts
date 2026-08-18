import { ASSET_BASE, ASSET_VERSION } from '../../config';

/** 立绘/素材完整 URL（文件位于 ASSET_BASE 下，附版本号破缓存） */
export function portraitUrl(file: string): string {
  return `${ASSET_BASE}/${file}?v=${ASSET_VERSION}`;
}
